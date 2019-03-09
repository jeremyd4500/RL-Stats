# RL Stats

RL Stats is a Discord Bot made in javascript using Node.js to fetch players' competitive ranks on the [Rocket League Tracker Network] and give them roles based on their ranks.

##### Table of Contents

1. [Features](#Features)
2. [How RL Stats Works](#How-RL-Stats-Works)
3. [Order of Events](#Order-of-Events)
4. [Tables](#Tables)
5. [Commands](#Commands)
6. [Installation](#Installation)
7. [Known Issues](#Known-Issues)
8. [To-do](#To-do)
9. [Code Contribution Rules](#Code-Contribution-Rules)

### Features

- Create or Delete roles for every competitive rank with one command.
- Categorize discord members into categories (Champion, Diamond, Platinum, etc.) based on their highest rank.
- Regularly fetch and update each users' ranks and display them in Discord.

### How RL Stats Works

RL Stats uses a locally-hosted MySQL database to store its data. It has a **users**, **ranks**, and **queue** table that all data is stored in. Users are stored and referenced by their unique Discord ID's.

---

### Order of Events

---

1. Newly "registered" users are put into the **queue** table.
2. Every 5 minutes, the queue will be checked and queued users are put into the **users** table. For each user that is put into the **users** table, an entry is put into the **ranks** table that fills all competitive ranks and their highest rank with "Unranked".
3. Every 20 minutes, each entry in the **users** table will be searched for on the Tracker Network and whatever ranks are found will be added to the **ranks** table.
4. Every 10 minutes, each user's highest rank category will be re-evaluated based on their ranks in the database.
5. Every 15 minutes, the roles for each users' competitive ranks in the database will be re-evaluated.

---

### Tables

---

**users** - "ID" is auto incremeneted and is the primary key

|ID|DiscordID|Platform|AccountID|
|------|------|------|------|
|5|156324616134384321|steam|jeremyd4500|

**ranks** - "UserID" is a foreign key of `users`:`ID` and is the primary key

|UserID|Highest|Standard|Doubles|SoloDuel|SoloStandard|Rumble|Dropshot|Hoops|SnowDay|
|------|------|------|------|------|------|------|------|------|------|
|5|Diamond|Diamond III|Diamond III|Diamond I|Diamond I|Platinum I|Diamond II|Diamond II|Diamond II|

**queue** - "ID" is auto incremented and is the primary key

|ID|DiscordID|Platform|AccountID|
|------|------|------|------|
|(auto)||||

---

### Commands

---

`!rlregister`

This command first searches the Tracker Network website with the provided arguments to verify the account exists. If it does exist, an entry for the user that called the command is inserted into the **queue** table.

|Argument|Required|Description|
|------|------|------|
|Platform|Yes|The user's platform they play Rocket League on|
|AccountID|Yes|The user's Tracker Network account name|

**Available Platforms**: `steam`, `ps`, `xbox`

The bot uses the base URL `https://rocketleague.tracker.network/profile/` and adds each user's Platform and AccountID to build the full URL `https://rocketleague.tracker.network/profile/steam/jeremyd4500`.

---

`!rlhelp`

The help command that gives a brief description which looks like this:
> **This is RL Stats!**
>
> I will keep your Rocket League competitive ranks updated for you in this Discord server!
>
> **Commands**
>
> !rlregister Platform AccountID
>  
> **Note**
>
> Available Platforms: `steam`, `ps`, `xbox`
>
> If you are on steam: Make sure to give your *Account Name* and not your profile name.
>
> For a complete guide to setting up your Steam Account (if applicable) and Rocket League Tracker Network account to work with RL Stats, click the link below.
>
> https://docs.google.com/document/d/1wvKjSyu7Iig0qY9T4bFf7Z-EwM1KRrvZqbcbfqK7ssY/edit?usp=sharing
---
  
`!rlsetuproles` - **Admin** only (Must have a role called `Admin`)
  
This command builds out rank roles for all competitive modes shown in the **ranks** table. The created roles are correctly colored to the appropriate rank color in Rocket League. Example of created roles (160 in total):

> Standard Unranked
>
> Standard Bronze I
>
> Standard Bronze II
>
> Standard Bronze III
>
> ...
>
> Standard Grand Champion
---

`!rlcleanroles` - **Admin** only (Must have a role called `Admin`)

This command simply deletes all the roles created by RL Stats if you ever choose to remove the bot from your discord server.

---

### Installation

---

##### Node.js setup

1. Make sure you have the latest version of [Node.js].
2. Download the repository to wherever you want to use the bot from.
3. Open up an administrator powershell window or similar command line tool.
4. Run the following commands:

```sh
$ cd "<bot folder>"
$ npm init
```

Fill in the fields as you like **(don't change the entry point)** or leave them all blank (by hitting "Enter" through the prompts). Then enter the command:

```sh
$ npm install --save discord.js fs mysql request request-promise cheerio puppeteer
```

---

##### MySQL Setup

1. Install the latest version of MySQL for whatever operating system you're on. Click [here][mysql-download] for the the zip archives for MySQL Community Server. Click [here][mysql-install] for the Windows msi installer for MySQL Community Server.
2. Setup the required database and tables using the `Setup DB and Tables.sql` file.
3. Adjust the MySQL connection settings in `index.js` according to your newly setup server.

---

##### Bot Setup

1. Follow the steps on [this][DiscordAPP] site to setup a Discord Application (I use the `Logo.jpg` file included in the repository as the bot's Icon image).
2. Make sure to copy your newly created Discord Application's Token and paste it into the `Token` variable in `index.js`.
3. In Discord, if it isn't already, verify that **Developer Mode** is enabled.
4. Right Click on the server you want to use the bot in and select "Copy ID". Paste that into the `ServerID` variable in `index.js`.
5. Find the `UpdateRankRoles()` function in `index.js` and find `tempRanks.push('@everyone')`. Duplicate this line for any pre-existing roles in your server.
6. If you don't have this already, either give yourself a role named "Admin" or modify `index.js` (the `UserIsAdmin()` function) to look for a differently named role. The purpose of this step is to only allow the `!rlsetuproles` and `!rlcleanroles` commands to be used by administrator users.
7. When you are ready to activate the bot, open up a powershell window or similar command line tool and type the following commands:

```sh
$ cd "<bot folder>"
$ node index
```

8. Send the following message in your discord serer:

```sh
$ !rlsetuproles
```

Note that this step will take a minute or two to complete. You can go to Server Settings > Roles to view them being created. You'll know when it's done by seeing `Snow Day Grand Champion` at the very bottom.

9. The last step is to look at the first 8 roles that were created (`Grand Champion`,`Champion`,...,`Unranked`). These roles are used to categorize each user's highest rank. For each of these roles, you need to enable "**Display role members separately from online members**".
10. Now you're done! You can now start registering users with the bot. I recommend typing `!rlhelp` so you and your server members can view the google doc listed to make sure your accounts are setup the right way.

---

### Known Issues

---

- Discord.js has a default listener count of 10. The `UpdateRankRoles()` function may cause the listener count to exceed 10 which will cause the bot to error out and go offline. I have attempted to "space out" the role updates via `setTimeout()` but it can still fail. I'm sure there is a better way to do this. At the top of `index.js` there is a block of commented code that was my attempt to remove the listener cap to no avail. My temporary solution was to perform a "Find in Files" with Notepad++ (for "setmaxlisteners") in the Discord.js package and manually edit the max listener count to 0 (Zero) wherever it is referenced.

---

### To-do

---

- Find a better way to wait for the promises of each mysql query to resolve instead of using `setTimeout()`
- Find a fix for the max listener count without having to edit the Discord.js package by hand.
- Possibly make this README flow better and make it more readable.

---

### Code Contribution Rules

---

- Please know that any and all help is wanted!
- If you are making a pull request, **DO NOT** include your personal mysql connection info (your database password specifically), your bot Token, or your ServerID.
- Do not make a pull request with large amounts of edits. Please focus on one are at a time and do not try to re-write the whole program.
- Do not include extra files in your pull request that are not necessary to your specific change.

---

### License

---

MIT

[DiscordAPP]: <https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/>
[Rocket League Tracker Network]: <https://rocketleague.tracker.network/>
[node.js]: <http://nodejs.org>
[mysql-download]: <https://dev.mysql.com/downloads/mysql/>
[mysql-install]: <https://dev.mysql.com/downloads/installer/>
