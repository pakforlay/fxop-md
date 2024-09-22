const { Module, mode } = require("../lib");
const axios = require("axios");
const words = require("an-array-of-english-words");
const fs = require("fs").promises;
const path = require("path");

let wcgGames = {};
const GAME_DURATION = 180000;
const WORD_MIN_LENGTH = 3;
const WORD_MAX_LENGTH = 15;
const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
const POINTS_PER_WORD = 10;
const BONUS_POINTS = 5;
const PENALTY_POINTS = 5;
const LEADERBOARD_FILE = path.join(__dirname, "..", "lib", "games", "wcg.json");

const wordSet = new Set(words);
async function loadLeaderboard() {
	try {
		const data = await fs.readFile(LEADERBOARD_FILE, "utf8");
		return JSON.parse(data);
	} catch (error) {
		if (error.code === "ENOENT") {
			return {};
		}
		console.error("Error loading leaderboard:", error);
		return {};
	}
}

async function saveLeaderboard(leaderboard) {
	try {
		await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
	} catch (error) {
		console.error("Error saving leaderboard:", error);
	}
}

Module(
	{
		pattern: "wcg",
		fromMe: mode,
		desc: "Start a Word Chain Game.",
		type: "game",
	},
	async (message, match) => {
		const chatId = message.key.remoteJid;

		if (wcgGames[chatId]) {
			return message.reply("A Word Chain Game is already in progress in this chat.");
		}

		const difficulty = match.trim().toLowerCase();
		if (!DIFFICULTY_LEVELS.includes(difficulty)) {
			return message.reply(`Please specify a valid difficulty level: ${DIFFICULTY_LEVELS.join(", ")}`);
		}

		wcgGames[chatId] = {
			players: {},
			currentWord: "",
			usedWords: new Set(),
			startTime: Date.now(),
			difficulty: difficulty,
			timer: setTimeout(() => endGame(chatId), GAME_DURATION),
		};

		const startWord = getRandomWord();
		wcgGames[chatId].currentWord = startWord;
		wcgGames[chatId].usedWords.add(startWord);

		message.reply(`Word Chain Game started! Difficulty: ${difficulty}\nThe starting word is: ${startWord}\nYou have 3 minutes. Go!`);
	},
);

Module(
	{
		on: "text",
		fromMe: false,
		pattern: false,
		dontAddCommandList: true,
	},
	async (message, match) => {
		const chatId = message.key.remoteJid;
		const userId = message.sender;
		const userWord = message.text.trim().toLowerCase();

		if (wcgGames[chatId] && isValidWord(userWord, chatId)) {
			const game = wcgGames[chatId];

			if (!game.players[userId]) {
				game.players[userId] = { score: 0, streak: 0 };
			}

			const points = calculatePoints(userWord, game.difficulty);
			game.players[userId].score += points;
			game.players[userId].streak++;

			if (game.players[userId].streak % 3 === 0) {
				game.players[userId].score += BONUS_POINTS;
				message.reply(`Streak bonus! +${BONUS_POINTS} points`);
			}

			game.currentWord = userWord;
			game.usedWords.add(userWord);

			message.reply(`Valid word! +${points} points. The new word is: ${userWord}`);

			if (isGameWinningWord(userWord)) {
				clearTimeout(game.timer);
				endGame(chatId, `${message.pushName} won with the word "${userWord}"!`);
			}
		}
	},
);

function isValidWord(word, chatId) {
	const game = wcgGames[chatId];
	return word.length >= WORD_MIN_LENGTH && word.length <= WORD_MAX_LENGTH && word[0] === game.currentWord[game.currentWord.length - 1] && wordSet.has(word) && !game.usedWords.has(word);
}

function calculatePoints(word, difficulty) {
	let points = word.length * POINTS_PER_WORD;
	switch (difficulty) {
		case "medium":
			points *= 1.5;
			break;
		case "hard":
			points *= 2;
			break;
	}
	return Math.round(points);
}

function isGameWinningWord(word) {
	return word.length >= 10 && new Set(word).size === word.length;
}

function getRandomWord() {
	return words[Math.floor(Math.random() * words.length)];
}

async function endGame(chatId, reason = "Time's up!") {
	const game = wcgGames[chatId];
	if (!game) return;

	clearTimeout(game.timer);

	let leaderboard = await loadLeaderboard();

	// Update leaderboard with game results
	for (const [playerId, playerData] of Object.entries(game.players)) {
		if (!leaderboard[playerId]) {
			leaderboard[playerId] = { totalScore: 0, gamesPlayed: 0 };
		}
		leaderboard[playerId].totalScore += playerData.score;
		leaderboard[playerId].gamesPlayed += 1;
	}

	await saveLeaderboard(leaderboard);

	let gameLeaderboard = Object.entries(game.players)
		.sort(([, a], [, b]) => b.score - a.score)
		.map(([playerId, player], index) => `${index + 1}. ${playerId}: ${player.score} points`)
		.join("\n");

	const endMessage = `${reason}\nGame Over! Final Scores:\n${gameLeaderboard}\n\nOverall Leaderboard:\n${getOverallLeaderboard(leaderboard)}`;
	await axios.post(`YOUR_BOT_API_ENDPOINT`, {
		chatId: chatId,
		message: endMessage,
	});

	delete wcgGames[chatId];
}

function getOverallLeaderboard(leaderboard) {
	return Object.entries(leaderboard)
		.sort(([, a], [, b]) => b.totalScore - a.totalScore)
		.slice(0, 5) // Top 5 players
		.map(([playerId, data], index) => `${index + 1}. ${playerId}: ${data.totalScore} points (${data.gamesPlayed} games)`)
		.join("\n");
}

// Hint command
Module(
	{
		pattern: "wcghint",
		fromMe: false,
		desc: "Get a hint for the current word in Word Chain Game.",
		type: "game",
	},
	async (message, match) => {
		const chatId = message.key.remoteJid;
		const userId = message.sender;

		if (!wcgGames[chatId]) {
			return message.reply("No Word Chain Game is currently active in this chat.");
		}

		const game = wcgGames[chatId];
		if (!game.players[userId]) {
			return message.reply("You haven't participated in the game yet.");
		}

		const hintWord = getHintWord(game.currentWord, game.difficulty);
		game.players[userId].score -= PENALTY_POINTS;

		message.reply(`Hint: ${hintWord}\nPenalty: -${PENALTY_POINTS} points`);
	},
);

function getHintWord(currentWord, difficulty) {
	const lastLetter = currentWord[currentWord.length - 1];
	const possibleWords = words.filter(word => word[0] === lastLetter && !wcgGames[chatId].usedWords.has(word) && word.length >= WORD_MIN_LENGTH && word.length <= WORD_MAX_LENGTH);

	let hintWord;
	switch (difficulty) {
		case "easy":
			hintWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
			return `${hintWord[0]}${"*".repeat(hintWord.length - 2)}${hintWord[hintWord.length - 1]}`;
		case "medium":
			hintWord = possibleWords.find(word => word.length >= 6) || possibleWords[Math.floor(Math.random() * possibleWords.length)];
			return `${hintWord[0]}${"*".repeat(hintWord.length - 1)}`;
		case "hard":
			hintWord = possibleWords.find(word => word.length >= 8) || possibleWords[Math.floor(Math.random() * possibleWords.length)];
			return `${hintWord[0]}${"*".repeat(Math.floor(hintWord.length / 2) - 1)}`;
	}
}
