const { Module, mode } = require("../lib");
const axios = require("axios");
const fs = require("fs").promises;

let wcgGames = {};
const GAME_DURATION = 180000; // 3 minutes
const WORD_MIN_LENGTH = 3;
const WORD_MAX_LENGTH = 15;
const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
const POINTS_PER_WORD = 10;
const BONUS_POINTS = 5;
const PENALTY_POINTS = 5;

// Load word list
let wordList;
async function loadWordList() {
	try {
		const data = await fs.readFile("path/to/your/wordlist.txt", "utf8");
		wordList = new Set(data.split("\n").map(word => word.trim().toLowerCase()));
	} catch (error) {
		console.error("Error loading word list:", error);
		throw error;
	}
}
loadWordList();

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
	return word.length >= WORD_MIN_LENGTH && word.length <= WORD_MAX_LENGTH && word[0] === game.currentWord[game.currentWord.length - 1] && wordList.has(word) && !game.usedWords.has(word);
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
	const words = Array.from(wordList);
	return words[Math.floor(Math.random() * words.length)];
}

async function endGame(chatId, reason = "Time's up!") {
	const game = wcgGames[chatId];
	if (!game) return;

	clearTimeout(game.timer);

	let leaderboard = Object.entries(game.players)
		.sort(([, a], [, b]) => b.score - a.score)
		.map(([playerId, player], index) => `${index + 1}. ${playerId}: ${player.score} points`)
		.join("\n");

	const endMessage = `${reason}\nGame Over! Final Scores:\n${leaderboard}`;
	await axios.post(`YOUR_BOT_API_ENDPOINT`, {
		chatId: chatId,
		message: endMessage,
	});

	delete wcgGames[chatId];
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
	const possibleWords = Array.from(wordList).filter(word => word[0] === lastLetter && !wcgGames[chatId].usedWords.has(word));

	let hintWord;
	switch (difficulty) {
		case "easy":
			hintWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
			return `${hintWord[0]}${"*".repeat(hintWord.length - 2)}${hintWord[hintWord.length - 1]}`;
		case "medium":
			hintWord = possibleWords.find(word => word.length >= 6);
			return `${hintWord[0]}${"*".repeat(hintWord.length - 1)}`;
		case "hard":
			hintWord = possibleWords.find(word => word.length >= 8);
			return `${hintWord[0]}${"*".repeat(Math.floor(hintWord.length / 2) - 1)}`;
	}
}
