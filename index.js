const Discord = require('discord.js')
const FS = require('fs')
const rp = require('request-promise')
const $ = require('cheerio')
const mysql = require('mysql')
require('events').EventEmitter.prototype._maxListeners = 0

// MySQL Connection Settings
var pool = mysql.createPool({
    connectionLimit : 100,
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'rlusers',
})

// Boolean variables used for state checking
var emptyQueue = true
var handlingQueue = false
var updatingRanks = false
var checkingHighest = false
var checkingRoles = false

const platforms = ['steam','ps','xbox']

const modes = ['Standard','Doubles','Solo Duel','Solo Standard','Rumble','Dropshot','Hoops','Snow Day']

const ranks = ['Bronze','Silver','Gold','Platinum','Diamond','Champion']
const rankColors = ['#d6680e','#9aaab4','#eec42c','#00d5eb','#4198d9','#9a58b4']

const ranks2 = ['Unranked','Bronze','Silver','Gold','Platinum','Diamond','Champion','Grand Champion']
const rankColors2 = ['#627d8a','#d6680e','#9aaab4','#eec42c','#00d5eb','#4198d9','#9a58b4','#703589']

var rankValues = [] // is filled in by SetRankValues()

const tiers = ['I','II','III']

const URL = 'https://rocketleague.tracker.network/profile/'
const currentSeason = '10' // Update to current season when it changes

const TOKEN = '' // Fill with your discord app Token
const ServerID = '' // ID of the server you want to use the bot in
var bot = new Discord.Client()
bot.login(TOKEN)

bot.on('ready', function() {
    console.log('RL Stats Activated.')

    // Verify log.txt exists or create it
    VerifyLogFile()
    UpdateLogFile('RL Stats Activated.')

    SetRankValues()

    // Production Intervals
    setInterval(async function(){ emptyQueue = await CheckQueue() }, 60*1000)
    setInterval(async function(){ if (!handlingQueue) { HandleQueue() } }, 5*60*1000)
    setInterval(async function(){ if (!updatingRanks) { UpdateUsers() } }, 20*60*1000)
    setInterval(async function(){ if (!checkingHighest) { CheckHighest() } }, 10*60*1000)
    setInterval(async function(){ if (!checkingRoles) { CheckRoles() } }, 15*60*1000)

    // Older versions with more boolean checks
    // setInterval(async function(){ emptyQueue = await CheckQueue() }, 60*1000)
    // setInterval(async function(){ if (!handlingQueue && !updatingRanks) { HandleQueue() } }, 5*60*1000)
    // setInterval(async function(){ if (!handlingQueue && !updatingRanks) { UpdateUsers() } }, 20*60*1000)
    // setInterval(async function(){ if (!checkingHighest) { CheckHighest() } }, 10*60*1000)
    // setInterval(async function(){ if (!checkingRoles && !updatingRanks) { CheckRoles() } }, 15*60*1000)

    // Testing with shorter times
    // setInterval(async function(){ emptyQueue = await CheckQueue() }, 20*1000)
    // setInterval(async function(){ if (!handlingQueue) { HandleQueue() } }, 60*1000)
    // setInterval(async function(){ if (!updatingRanks) { UpdateUsers() } }, 3*60*1000)
    // setInterval(async function(){ if (!checkingHighest) { CheckHighest() } }, 60*1000)
    // setInterval(async function(){ if (!checkingRoles) { CheckRoles() } }, 90*1000)
})

bot.on('disconnect', function() {
    UpdateLogFile('RL Stats Deactivated.')
})

bot.on('reconnecting', function() {
    UpdateLogFile('RL Stats Reconnecting.')
})

bot.on('resume', function() {
    UpdateLogFile('RL Stats Resumed.')
})

bot.on('error', function(error) {
    console.log(error.message)
    UpdateLogFile(error.message)
})

bot.on('message', function(message) {

    // Do nothing if the message is from the bot
    if (message.author.equals(bot.user)) {
        return
    } 

    // Ignore all messages unless they start with '!rl'
    if (message.content.toLowerCase().startsWith('!rl')) {

        // Help command
        if (message.content.toLowerCase() ==='!rlhelp'){
            var embed = new Discord.RichEmbed()
                .setColor('#0291ED')
                .addField('This is RL Stats!', "I will keep your Rocket League competitive ranks updated for you in this Discord server!")
                .addField('Commands',
                '!rlregister  <Platform>  <Account Name>')
                .addField('Note',
                '**Available Platforms**: `steam`, `ps`, `xbox`\n' +
                'If you are on steam: Make sure to give your __Account Name__ and not your profile name.\n' +
                'For a complete guide to setting up your Steam Account (if applicable) and Rocket League Tracker Network account to work with RL Stats, click the link below.\n' + 
                'https://docs.google.com/document/d/1wvKjSyu7Iig0qY9T4bFf7Z-EwM1KRrvZqbcbfqK7ssY/edit?usp=sharing')
            message.channel.send(embed)
        }
        
        // Command for building all necessary roles
        // Must have a role called 'Admin' to be able to use it
        if (message.content.toLowerCase() == '!rlsetuproles') {
            if (UserIsAdmin(message)){
                BuildRoleNames(message)
                message.channel.send('All rank roles have been created.')
            } else {
                message.channel.send(message.member.toString() + ' You are not an admin user!')
            }
        }

        // Command for deleting all roles created by the bot
        // Must have a role called 'Admin' to be able to use it
        if (message.content.toLowerCase() == '!rlcleanroles') {
            if (UserIsAdmin(message)){
                DeleteRoles(message)
                message.channel.send('All rank roles have been deleted.')
            } else {
                message.channel.send(message.member.toString() + ' You are not an admin user!')
            }
        }

        // Command for registering users with the bot
        if (message.content.toLowerCase().startsWith('!rlregister')){
            // Verify no users are mentioned in the message
            if (UserMentioned(message)){
                message.channel.send('User mentions are not supported!')
            } else {
                var fullCommand = message.content.split(' ')
                // Verify the correct amount of arguments were given
                if (fullCommand.length != 3){
                    message.channel.send('Incorrect amount of arguments!\nExpected: `2`\nGiven: `'+(fullCommand.length-1)+'`')
                } else {
                    // Command should look like "!rlregister steam jeremyd4500"
                    var Platform = fullCommand[1].toLowerCase() // steam
                    var AccountID = fullCommand[2].toLowerCase() // jeremyd4500
                    // Verify the platform is one of the available options
                    if (platforms.includes(Platform)){
                        // Attempt to access a URL similar to 'https://rocketleague.tracker.network/profile/steam/jeremyd4500'
                        rp(URL+'/'+Platform+'/'+AccountID)
                            .then(function(html){
                                if (html.includes('We could not find your stats')) { // This page is shown with an invalid URL
                                    message.channel.send("I'm sorry. I could not find **" + AccountID + "** in the tracker network.")
                                } else {
                                    // Add new user to the queue table
                                    AddUserToQueue(message.member.id,Platform,AccountID)
                                    message.channel.send("Added stat request for **" + AccountID + "** under " + message.member.toString() + ' to the queue!')
                                }
                            })
                            .catch(function(error){
                                UpdateLogFile(error)
                            })
                    } else {
                        message.channel.send('That is not a correct platform!\nPlatform Options: `steam`,`ps`,`xbox`')
                    }
                }
            }
        }
    }
})

// SQL Query
// Updates the "Highest" column for the appropriate user
function AddHighest(DiscordID, rank){
    UpdateLogFile('Function Call: AddHighest()')
    return new Promise(resolve => {
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                var ID = await GetUserID(DiscordID)
                connection.query("update ranks set Highest = '"+rank+"' where UserID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully updated Highest to value '+rank+' for user '+DiscordID))
        }, 5000)
    })
}

// SQL Query
// Inserts "Unranked" into all rank columns for a new user
function AddRanksToUser(DiscordID) {
    UpdateLogFile('Function Call: AddRanksToUser()')
    return new Promise(resolve => {
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                var ID = await GetUserID(DiscordID)
                connection.query("insert into ranks (UserID,Highest,Standard,Doubles,SoloDuel,SoloStandard,Rumble,Dropshot,Hoops,SnowDay) values ('"+ID+"','Unranked','Unranked','Unranked','Unranked','Unranked','Unranked','Unranked','Unranked','Unranked')", function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully added blank ranks for user '+DiscordID))
        }, 5000)
    })
}

// Discord Process
// Adds a new role to the server if it doesn't already exist
function AddRole(message, RoleName, color){
    var role = message.guild.roles.find(role => role.name === RoleName)
    if (role){
        UpdateLogFile("Role '" + RoleName + "' already exists!")
    } else {
        message.guild.createRole({
            name: RoleName,
            color: color
        }) 
        UpdateLogFile("Role '" + RoleName + "' has been created!")
    }    
}

// Discord Process
// Adds a role to a user if it exists
function AddRoleToUser(DiscordID, RoleName){
    UpdateLogFile('Function Call: AddRoleToUser()')
    return new Promise(resolve => {
        var success = false
        let newRole = bot.guilds.get(ServerID).roles.find(role => role.name === RoleName).id
        if (newRole){
            bot.guilds.get(ServerID).members.get(DiscordID).addRole(newRole)
            success = true
        } else {
            UpdateLogFile('Role '+RoleName+' does not exist')
            success = false
        }
        setTimeout(() => {
            if (success){
                resolve(UpdateLogFile('Discord Process: Successfully added role '+RoleName+' to user '+DiscordID))
            } else {
                resolve(UpdateLogFile('Discord Process: Failed to add role '+RoleName+' to user '+DiscordID))
            }
        }, 2000)
    })
}

// SQL Query
// Adds a user from the queue table to the users table and then inserts blank ranks for them
function AddUser(DiscordID, Platform, AccountID) {
    UpdateLogFile('Function Call: AddUser()')
    return new Promise(resolve => {
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("insert into users (DiscordID,Platform,AccountID) values ('"+DiscordID+"','"+Platform+"','"+AccountID+"')", async function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        await AddRanksToUser(DiscordID)
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully added user '+DiscordID+' to the database'))
        }, 5000)
    })
}

// SQL Query
// Updates any column for a user in the users table
function AddUserDetail(ID, column, value){
    UpdateLogFile('Function Call: AddUserDetail()')
    return new Promise(resolve => {
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("update users set "+column+" = '"+value+"' where ID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully updated detail '+column+' with value '+value+' for user '+ID))
        }, 5000)
    })
}

// SQL Query
// Updates any column for a user in the ranks table
function AddUserStat(UserID, column, value){
    UpdateLogFile('Function Call: AddUserStat()')
    return new Promise(resolve => {
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("update ranks set "+column+" = '"+value+"' where UserID = "+UserID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully updated stat '+column+' with value '+value+' for user '+UserID))
        }, 5000)
    })
}

// SQL Query
// Adds a new user to the queue table
function AddUserToQueue(DiscordID,Platform,AccountID){
    UpdateLogFile('Function Call: AddUserToQueue()')
    return new Promise(resolve => {
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("insert into queue (DiscordID,Platform,AccountID) values ('"+DiscordID+"','"+Platform+"','"+AccountID+"')", function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully added queue entry for user '+DiscordID))
        }, 5000)
    })
}

// Javascript
// Creates all roles needed by the bot and calls AddRole() for each
function BuildRoleNames(message){
    UpdateLogFile('Function Call: BuildRoleNames()')
    // First add the "Highest" roles
    for (let i = ranks2.length-1; i >= 0; i--){
        AddRole(message, ranks2[i], rankColors2[i]) 
    }
    // Then add all the rank roles
    for (let i = 0; i < modes.length; i++){
        var currentRole = modes[i] + ' Unranked'
        AddRole(message, currentRole, '#627d8a')
        for (let j = 0; j < ranks.length; j++){
            for (let k = 0; k < tiers.length; k++){
                currentRole = modes[i] + ' ' + ranks[j] + ' ' + tiers[k]
                AddRole(message, currentRole, rankColors[j]) 
            }
        }
        currentRole = modes[i] + ' Grand Champion'
        AddRole(message, currentRole, '#703589')
    }
}

// Javascript
// Gets an array of Discord ID's from the users table and calls UpdateHighest() for each
async function CheckHighest(){
    checkingHighest = true
    var users = await GetUsers()
    for (let i = 0; i < users.length; i++){
        await UpdateHighest(users[i])
    }
    checkingHighest = false
}

// SQL Query
// Checks if the queue table is empty
function CheckQueue(){
    UpdateLogFile('Function Call: CheckQueue()')
    return new Promise(resolve => {
        var isEmpty = true
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query('select * from queue', function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        if (results.length > 0){
                            isEmpty = false
                        }
                        UpdateLogFile('SQL Query: Successfully retrieved the queue')
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(isEmpty)
        }, 5000)
    })
}

// Javascript
// Gets an array of Discord ID's from the users table and calls UpdateRankRoles() for each
async function CheckRoles(){
    checkingRoles = true
    var users = await GetUsers()
    for (let i = 0; i < users.length; i++){
        await UpdateRankRoles(users[i])
    }
    checkingRoles = false
}

// Discord Process
// Deletes a role created by the bot if it exists
function DeleteRole(message, roleName){
    var role = message.guild.roles.find(role => role.name === roleName)
    if (role){
        role.delete()
        UpdateLogFile("Role '" + roleName + "' has been deleted!")
    } else {
        UpdateLogFile("Role '" + roleName + "' does not exist!")
    } 
}

// Javascript
// Creates the name of each role created by the bot and calls DeleteRole() for each
function DeleteRoles(message){
    // First delete the "Highest" roles
    for (let i = ranks2.length-1; i >= 0; i--){
        DeleteRole(message, ranks2[i]) 
    }
    // Then delete the rank roles
    for (let i = 0; i < modes.length; i++){
        var currentRole = modes[i] + ' Unranked'
        DeleteRole(message, currentRole)
        for (let j = 0; j < ranks.length; j++){
            for (let k = 0; k < tiers.length; k++){
                currentRole = modes[i] + ' ' + ranks[j] + ' ' + tiers[k]
                DeleteRole(message, currentRole) 
            }
        }
        currentRole = modes[i] + ' Grand Champion'
        DeleteRole(message, currentRole)
    }
}

// Javascript
// Updates the Platform and AccoundID for a user
// Calls AddUserStat() to inserts "Unranked" for all ranks for a user
async function EditUser(DiscordID, Platform, AccountID) {
    UpdateLogFile('Function Call: EditUser()')
    var ID = await GetUserID(DiscordID)
    await AddUserDetail(ID, 'Platform', Platform)
    await AddUserDetail(ID, 'AccountID', AccountID)
    var SQLRanks = []
    modes.forEach(function(item){
        SQLRanks.push(item)
    })
    SQLRanks.push('Highest')
    SQLRanks.forEach(async function(item){
        item = item.replace(' ','')
        await AddUserStat(ID, item, 'Unranked')
    })
}

// SQL Query
// Retrieves the value in the "Highest" column for a user in the ranks table
function GetHighest(DiscordID){
    UpdateLogFile('Function Call: GetHighest()')
    return new Promise(resolve => {
        var highest = 'Unranked'
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                var ID = await GetUserID(DiscordID)
                connection.query("select Highest from ranks where UserID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        highest = results[0].Highest
                        UpdateLogFile('SQL Query: Successfully retrieved Highest rank for user '+DiscordID)
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(highest)
        }, 8000)
    })
}

// SQL Query
// Gets an array of all columns for each user in the queue table
function GetQueue(){
    UpdateLogFile('Function Call: GetQueue()')
    return new Promise(resolve => {
        var Queue = 0
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query('select * from queue', function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        if (results.length > 0){
                            Queue = []
                            results.forEach(function (item) {
                                Queue.push({
                                    ID: item.ID,
                                    DiscordID: item.DiscordID,
                                    Platform: item.Platform,
                                    AccountID: item.AccountID
                                })
                            })
                        }
                        UpdateLogFile('SQL Query: Successfully retrieved the queue')
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(Queue)
        }, 5000)
    })
}

// Javascript
// Used to compare a numeric value tied each rank
// Retrieves a rank based on a given value
function GetRank(value){
    UpdateLogFile('Function Call: GetRank()')
    var rank = 'Unranked'
    rankValues.forEach(function(item){
        if (item.value === value){
            rank = item.rank
        }
    })
    return rank
}

// Javascript
// Used to compare a numeric value tied each rank
// Retrieves a value based on a given rank
function GetRankValue(rank){
    UpdateLogFile('Function Call: GetRankValue()')
    var Value = 0
    rankValues.forEach(function(item){
        if (item.rank === rank){
            Value = item.value
        }
    })
    return Value
}

// SQL Query
// Gets an array of all columns for each user in the users table
function GetUserDetails(DiscordID){
    UpdateLogFile('Function Call: GetUserDetails()')
    return new Promise(resolve => {
        var details = []
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                var ID = await GetUserID(DiscordID)
                connection.query("select * from users where ID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        details.push(results[0].ID)
                        details.push(results[0].DiscordID)
                        details.push(results[0].Platform)
                        details.push(results[0].AccountID)
                        UpdateLogFile('SQL Query: Successfully retrieved all details for user '+DiscordID)
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(details)
        }, 10000)
    })
}

// SQL Query
// Gets the generated ID for a user in the users table
function GetUserID(DiscordID) {
    UpdateLogFile("Function Call: GetUserID()")
    return new Promise(resolve => {
        var ID = 0
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("select ID from users where DiscordID = '" + DiscordID + "'", function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        ID = results[0].ID
                        UpdateLogFile('SQL Query: Successfully retrieved ID for user '+DiscordID)
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(ID)
        }, 5000)
    })
}

// SQL Query
// Gets an array of all ranks for a user in the ranks table
function GetUserRanks(DiscordID){
    UpdateLogFile('Function Call: GetUserRanks()')
    return new Promise(resolve => {
        var ranks = []
        pool.getConnection(async function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                var ID = await GetUserID(DiscordID)
                connection.query("select * from ranks where UserID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        ranks.push(results[0].Standard)
                        ranks.push(results[0].Doubles)
                        ranks.push(results[0].SoloDuel)
                        ranks.push(results[0].SoloStandard)
                        ranks.push(results[0].Rumble)
                        ranks.push(results[0].Dropshot)
                        ranks.push(results[0].Hoops)
                        ranks.push(results[0].SnowDay)
                        UpdateLogFile('SQL Query: Successfully retrieved all ranks for user '+DiscordID)
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(ranks)
        }, 10000)
    })
}

// SQL Query
// Gets an array of Discord ID's for all users in the users table
function GetUsers() {
    UpdateLogFile('Function Call: GetUsers()')
    return new Promise(resolve => {
        var users = []
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query('select DiscordID from users', function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        for (let i = 0; i < results.length; i++){
                            users.push(results[i].DiscordID)
                        }
                        UpdateLogFile('SQL Query: Successfully retrieved DiscordID for all users')
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(users)
        }, 5000)
    })
}

// Javascript
// If the queue is not empty, either add or update a user to/in the users table
async function HandleQueue(){
    UpdateLogFile('Function Call: HandleQueue()')
    if (!emptyQueue){
        handlingQueue = true
        var queue = await GetQueue()
        if (queue === 0){
            emptyQueue = true
            handlingQueue = false
        } else {
            emptyQueue = false
            for (let i = 0; i < queue.length; i++){
                if (await NewUser(queue[i].DiscordID)){
                    await AddUser(queue[i].DiscordID,queue[i].Platform,queue[i].AccountID)
                } else {
                    await EditUser(queue[i].DiscordID,queue[i].Platform,queue[i].AccountID)
                }
                await RemoveFromQueue(queue[i].ID)
            }
            handlingQueue = false
        }
        
    }
}

// SQL Query
// Checks to see if a user already exists in the users table
function NewUser(DiscordID) {
    UpdateLogFile('Function Call: NewUser()')
    return new Promise(resolve => {
        var newUser = true
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("select * from users where DiscordID = '" + DiscordID + "'", function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) } else {
                        if (results.length > 0){
                            newUser = false
                            UpdateLogFile('SQL Query: User '+DiscordID+' already exists')
                        } else {
                            UpdateLogFile('SQL Query: User '+DiscordID+' does not exist')
                        }
                    }
                })     
            }
        })
        setTimeout(() => {
            resolve(newUser)
        }, 5000)
    })
}

// SQL Query
// Removes a user from the queue table
function RemoveFromQueue(ID){
    UpdateLogFile('Function Call: RemoveFromQueue()')
    return new Promise(resolve => {
        pool.getConnection(function(error, connection) {
            if (error){ UpdateLogFile(error) } else {
                connection.query("delete from queue where ID = "+ID, function (error, results, fields) {
                    connection.release()
                    if (error){ UpdateLogFile(error) }
                })     
            }
        })
        setTimeout(() => {
            resolve(UpdateLogFile('SQL Query: Successfully removed a user from the queue'))
        }, 5000)
    })
}

// Discord Process
// Removes a role from a user in the server
function RemoveRoleFromUser(DiscordID, Role){
    UpdateLogFile('Function Call: RemoveRoleFromUser()')
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(function(){
                bot.guilds.get(ServerID).members.get(DiscordID).removeRole(Role.ID)
                UpdateLogFile('Discord Process: Successfully removed role '+Role.Role+' from user '+DiscordID)
            })
        }, 2000)
    })
}

// Javascript
// Creates an array with values tied to each rank for use with the "Highest" role
function SetRankValues(){
    UpdateLogFile('Function Call: SetRankValues()')
    for (let i = 0; i < ranks2.length; i++){
        rankValues.push({
            rank: ranks2[i],
            value: i
        })
    }
}

// Updates a user's "Highest" role in the server
async function UpdateHighest(DiscordID){
    UpdateLogFile('Function Call: UpdateHighest()')
    var highest = await GetHighest(DiscordID)
    var highestValue = GetRankValue(highest) // The value of the old highest rank of the user
    var userRanks = await GetUserRanks(DiscordID)
    var currentHighest = 0
    // Get the value of the new highest rank of the user
    for (let i = 0; i < userRanks.length; i++){
        for (let j = rankValues.length-1; j >= 0; j--){
            if (userRanks[i].startsWith(rankValues[j].rank)){
                if (rankValues[j].value > currentHighest){
                    currentHighest = rankValues[j].value
                }
            }
        }
    }
    // Get the rank of the new or old highest value 
    if (currentHighest != highestValue){
        highest = GetRank(currentHighest)
    } else {
        highest = GetRank(highestValue)
    }

    let currentRole = bot.guilds.get(ServerID).roles.find(role => role.name === highest).id
    let existingRole = bot.guilds.get(ServerID).members.get(DiscordID).roles.has(currentRole)
    // If the current user does not have the role
    if (!existingRole){
        // Remove all other "Highest" roles the user might have
        for (let i = 0; i < ranks2.length; i++){
            let currentRole = bot.guilds.get(ServerID).roles.find(role => role.name === ranks2[i]).id
            if(bot.guilds.get(ServerID).members.get(DiscordID).roles.has(currentRole)){
                setTimeout(() => {
                    bot.guilds.get(ServerID).members.get(DiscordID).removeRole(currentRole)
                }, 1000);
            }
        }
        // Add the new "Highest" role to the user
        let currentRole = bot.guilds.get(ServerID).roles.find(role => role.name === highest).id
        bot.guilds.get(ServerID).members.get(DiscordID).addRole(currentRole)
        await AddHighest(DiscordID, highest)
    }
}

// Javascript
// Updates log.txt with a new value
function UpdateLogFile(newValue) {
    var CurrentTime = new Date()
    var today = CurrentTime.getDate().toString() + '/' + (CurrentTime.getMonth() + 1).toString() + '/' + CurrentTime.getFullYear().toString()
    var ClockTime = CurrentTime.getHours().toString() + ':' + CurrentTime.getMinutes().toString() + ':' + CurrentTime.getSeconds().toString()
    var FullTime = today + ' ' + ClockTime + ' >>> '
    FS.appendFile('log.txt', FullTime + newValue + '\r\n', function(error) {
        if (error) { console.log(error) }
    })
}

// Discord Process
// Updates all rank roles for a user in the server
async function UpdateRankRoles(DiscordID){
    var userRanks = await GetUserRanks(DiscordID)
    // Get an array of roles that the user should have
    var newRoles = []
    for (let i = 0; i < modes.length; i++){
        newRoles.push(modes[i] + ' ' + userRanks[i])
    }
    var userRoles = [] // Used for the user's existing roles
    var tempRanks = [] // Used as a list of roles to ignore
    ranks2.forEach(function(item){
        tempRanks.push(item)
    })
    tempRanks.push('@everyone')
    tempRanks.push('Admin') // Add a statement like this for any pre-existing role in your server
    // Get all roles from the user
    bot.guilds.get(ServerID).members.get(DiscordID).roles.forEach(function(role, key, map){
        if (!tempRanks.includes(role.name)){
            userRoles.push({
                Role: role.name,
                ID: role.id
            })
        }
    })
    newRoles.forEach(function(item){
        var itemFound = false
        // Check if user already has this role
        for (let i = 0; i < userRoles.length; i++){
            if (item === userRoles[i].Role){
                itemFound = true
            }
        }
        // If not, add the role to the user
        if (!itemFound){
            setTimeout(async function() {
                await AddRoleToUser(DiscordID, item)
            }, 1000)
        }
    })
    // Delay 5 seconds
    setTimeout(function(){
        userRoles = []
        // Get all the users roles again since they have been updated
        bot.guilds.get(ServerID).members.get(DiscordID).roles.forEach(function(role, key, map){
            if (!tempRanks.includes(role.name)){
                userRoles.push({
                    Role: role.name,
                    ID: role.id
                })
            }
        })
        userRoles.forEach(function(item){
            var itemFound = false
            // Check if the user has a role he shouldn't have 
            for (let i = 0; i < newRoles.length; i++){
                if (item.Role === newRoles[i]){
                    itemFound = true
                }
            }
            // If he does, delete the role from the user
            if (!itemFound){
                setTimeout(async function() {
                    await RemoveRoleFromUser(DiscordID, item)
                }, 1000)
            }
        })
    }, 5000)
}

// Javascript
// Parses the Rocket League Tracker Network to get each competitive rank for a user
async function UpdateStats(DiscordID){
    UpdateLogFile('Function Call: UpdateStats()')
    // Get all columns from the users table for the user
    var details = await GetUserDetails(DiscordID)
    var UserID = details[0]
    var Platform = details[2]
    var AccountID = details[3]
    var temp = []
    rp(URL+Platform+'/'+AccountID)
        .then(function(html){ 
            let data = [[],[]]
            var tableIndex = 1
            // Check whether the user has season rewards or not
            if ($('#season-' + currentSeason + ' .card-table.items', html)[tableIndex]){
                tableIndex = 1
            } else {
                tableIndex = 0
            }				   
            for (let k = 1; k < 18; k+=2){
                try {
                    // These are the addresses for each game mode and corresponding rank
                    // It is possible that they could change in the future if the website's structure changes
                    let newMode = $('#season-' + currentSeason + ' .card-table.items', html)[1].children[3].children[k].children[2].children[0].data.trim()
                    let newRank = $('#season-' + currentSeason + ' .card-table.items', html)[1].children[3].children[k].children[2].children[1].children[0].data.trim()
                    data[0].push(newMode)
                    data[1].push(newRank)
                } catch (error) {
                    UpdateLogFile('Mode or Rank not found for user '+DiscordID)
                }
            }
            return Promise.all(
                data.map(function(item){
                    temp.push(item)
                })
            )
        })
        .then(function(){
            var tempModes = temp[0]
            var tempRanks = temp[1]
            // remove the "Unranked" (Casual) category
            tempModes.splice(0,1)
            tempRanks.splice(0,1)
            for (let j = 0; j < tempRanks.length; j++){
                // Format each one appropriately
                tempModes[j] = tempModes[j].replace('Ranked ', '')
                tempModes[j] = tempModes[j].replace(' 1v1', '')
                tempModes[j] = tempModes[j].replace(' 2v2', '')
                tempModes[j] = tempModes[j].replace(' 3v3', '')
                tempModes[j] = tempModes[j].replace('Duel', 'Solo Duel')
                tempModes[j] = tempModes[j].replace('Snowday', 'Snow Day')
                tempModes[j] = tempModes[j].replace(' ', '')
                tempRanks[j] = tempRanks[j].slice(0, tempRanks[j].indexOf('\n'))
                // Add the new stat to ranks table for the user
                AddUserStat(UserID, tempModes[j], tempRanks[j])
            }
        })
        .catch(function(error){
            UpdateLogFile(error)
        }) 
}

// Javascript
// Gets an array of Discord ID's from the users table and calls UpdateStats() for each
async function UpdateUsers(){
    updatingRanks = true
    var users = await GetUsers()
    for (let i = 0; i < users.length; i++){
        await UpdateStats(users[i])
    }
    updatingRanks = false
}

// Discord Process
// Checks if a user has a role called "Admin"
function UserIsAdmin(message){
    UpdateLogFile('Function Call: UserIsAdmin()')
    var AdminRole = message.guild.roles.find(role => role.name === 'Admin')
    if (AdminRole){
        return message.member.roles.has(AdminRole.id)
    } else {
        return false
    } 
}

// Discord Process
// Checks if a user is mentioned in the command message
function UserMentioned(message){
    UpdateLogFile('Function Call: UserMentioned()')
    return message.mentions.members.first()
}

// Javascript
// Creates log.txt if it doesn't already exist
function VerifyLogFile(){
    FS.exists('log.txt', function(exists){
        if (exists){
            UpdateLogFile('log.txt already exists')
        } else {
            var log = FS.createWriteStream('log.txt')
            log.end()
        }
    })
}