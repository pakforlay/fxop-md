const { Module, mode, getJson, postJson } = require("../lib");
Module(
	{
		pattern: "joke",
		fromMe: mode,
		desc: "Get Jokes",
		type: "games",
	},
	async msg => {
		const load = await msg.reply("_Joking_");
		const res = await getJson("https://official-joke-api.appspot.com/jokes/random");
		return await load.edit(`*JOKE: ${res.setup}*\n*PUNCHLINE: ${res.punchline}`);
	},
);

Module;
