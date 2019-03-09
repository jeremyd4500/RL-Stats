CREATE DATABASE `rlusers` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;

USE rlusers;

CREATE TABLE `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DiscordID` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `Platform` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `AccountID` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `id_UNIQUE` (`ID`),
  UNIQUE KEY `DiscordID_UNIQUE` (`DiscordID`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ranks` (
  `UserID` int(11) NOT NULL,
  `Highest` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `Standard` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `Doubles` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `SoloDuel` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `SoloStandard` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `Rumble` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `Dropshot` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `Hoops` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  `SnowDay` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'Unranked',
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `UserID_UNIQUE` (`UserID`),
  CONSTRAINT `UserID_FK` FOREIGN KEY (`UserID`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `queue` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DiscordID` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `Platform` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `AccountID` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `ID_UNIQUE` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

