const { Module, mode, getJson, lyrics, sleep, Google, getFloor, onwhatsapp } = require("../lib");
const moment = require("moment");
const axios = require("axios");

Module(
	{
		pattern: "fx1",
		fromMe: mode,
		desc: "Fetches the latest forex news",
		type: "search",
	},
	async message => {
		const apiUrl = "https://api.polygon.io/v2/reference/news?apiKey=Y4iTYoJANwppB8I3Bm4QVWdV5oXlvc45";
		const data = await getJson(apiUrl);
		if (!data.results || data.results.length === 0) return message.send("*No forex news available at the moment.*");
		const output = data.results.map((article, index) => `*Title:* ${article.title}\n` + `*Publisher:* ${article.publisher.name}\n` + `*Published UTC:* ${article.published_utc}\n` + `*Article URL:* ${article.article_url}\n` + (index < data.results.length - 1 ? "---\n\n" : "")).join("");

		return message.send(output, { quoted: message });
	},
);

Module(
	{
		pattern: "fxstatus",
		fromMe: mode,
		desc: "Fetches the current status of the forex market",
		type: "search",
	},
	async message => {
		const apiUrl = "https://api.polygon.io/v1/marketstatus/now?apiKey=Y4iTYoJANwppB8I3Bm4QVWdV5oXlvc45";
		const data = await getJson(apiUrl);

		if (!data) return message.send("*Failed to fetch forex market status.*");

		const output = `*Forex Market Status:*\n` + `After Hours: ${data.afterHours ? "Closed" : "Open"}\n` + `Market: ${data.market ? "Open" : "Closed"}\n\n` + `*Currencies:*\n` + `Crypto: ${data.currencies.crypto}\n` + `FX: ${data.currencies.fx}\n\n` + `*Exchanges:*\n` + `NASDAQ: ${data.exchanges.nasdaq}\n` + `NYSE: ${data.exchanges.nyse}\n` + `OTC: ${data.exchanges.otc}\n\n` + `*Indices Groups:*\n` + `S&P: ${data.indicesGroups.s_and_p}\n` + `Societe Generale: ${data.indicesGroups.societe_generale}\n` + `MSCI: ${data.indicesGroups.msci}\n` + `FTSE Russell: ${data.indicesGroups.ftse_russell}\n` + `MStar: ${data.indicesGroups.mstar}\n` + `MStarC: ${data.indicesGroups.mstarc}\n` + `CCCY: ${data.indicesGroups.cccy}\n` + `CGI: ${data.indicesGroups.cgi}\n` + `NASDAQ: ${data.indicesGroups.nasdaq}\n` + `Dow Jones: ${data.indicesGroups.dow_jones}\n\n` + `*Server Time:* ${data.serverTime}`;

		return message.send(output, { quoted: message });
	},
);

Module(
	{
		pattern: "fxpairs",
		fromMe: mode,
		desc: "Fetches a list of active forex currency pairs",
		type: "search",
	},
	async message => {
		const apiUrl = "https://api.polygon.io/v3/reference/tickers?market=fx&active=true&apiKey=Y4iTYoJANwppB8I3Bm4QVWdV5oXlvc45";
		const data = await getJson(apiUrl);
		if (!data || !data.results || data.results.length === 0) return message.send("*Failed to fetch forex currency pairs.*");
		const output = data.results.map(pair => `${pair.ticker}: ${pair.name}`).join("\n");

		return message.send(`*Active Forex Currency Pairs:*\n\n${output}`, { quoted: message });
	},
);

Module(
	{
		pattern: "fxange",
		fromMe: mode,
		desc: "Fetches the latest foreign exchange rates against the US Dollar",
		type: "search",
	},
	async (message, match) => {
		const currencyCode = match || "USD";
		const apiUrl = `https://api.exchangerate-api.com/v4/latest/${currencyCode}`;
		const data = await getJson(apiUrl);

		if (!data || !data.rates) return message.send(`*Failed to fetch exchange rates for ${currencyCode}.*`);
		const output = Object.entries(data.rates)
			.map(([currency, rate]) => `${currency}: ${rate.toFixed(4)}`)
			.join("\n");

		return message.send(`*Foreign Exchange Rates (${data.base})*\n\n${output}`, { quoted: message });
	},
);

Module(
	{
		pattern: "stocks",
		fromMe: mode,
		desc: "Fetches a list of active stock tickers",
		type: "search",
	},
	async (message, match) => {
		const limit = match || 100;
		const apiUrl = `https://api.polygon.io/v3/reference/tickers?active=true&limit=${limit}&apiKey=Y4iTYoJANwppB8I3Bm4QVWdV5oXlvc45`;
		const data = await getJson(apiUrl);
		if (!data || !data.results || data.results.length === 0) return message.send("*No active stock tickers found.*");
		const output = data.results.map(ticker => `${ticker.ticker}: ${ticker.name}`).join("\n");
		return message.send(`*Active Stock Tickers (Limit: ${limit}):*\n\n${output}`, { quoted: message });
	},
);

Module(
	{
		pattern: "weather ?(.*)",
		fromMe: mode,
		desc: "weather info",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.send("*Example : weather delhi*");
		const data = await getJson(`http://api.openweathermap.org/data/2.5/weather?q=${match}&units=metric&appid=060a6bcfa19809c2cd4d97a212b19273&language=en`).catch(() => {});
		if (!data) return await message.send(`_${match} not found_`);
		const { name, timezone, sys, main, weather, visibility, wind } = data;
		const degree = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][getFloor(wind.deg / 22.5 + 0.5) % 16];
		return await message.send(`*Name :* ${name}\n*Country :* ${sys.country}\n*Weather :* ${weather[0].description}\n*Temp :* ${getFloor(main.temp)}°\n*Feels Like :* ${getFloor(main.feels_like)}°\n*Humidity :* ${main.humidity}%\n*Visibility  :* ${visibility}m\n*Wind* : ${wind.speed}m/s ${degree}\n*Sunrise :* ${moment.utc(sys.sunrise, "X").add(timezone, "seconds").format("hh:mm a")}\n*Sunset :* ${moment.utc(sys.sunset, "X").add(timezone, "seconds").format("hh:mm a")}`);
	},
);

Module(
	{
		pattern: "lyrics ?(.*)",
		fromMe: mode,
		desc: "Search lyrics of Song",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply(`\`\`\`Wrong format\n\n${message.prefix}lyrics Just the two of Us\`\`\``);
		const msg = await message.reply("_Searching for '" + match + "'_");
		const songLyrics = await lyrics(match);
		await msg.edit("_Lyrics Found!_");
		await sleep(1500);
		return await msg.edit(songLyrics);
	},
);

Module(
	{
		pattern: "google ?(.*)",
		fromMe: mode,
		desc: "Search Google",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Provide Me A Query" + message.pushName + "_\n\n" + message.prefix + "google fxop-md");
		const msg = await message.reply("_Searching for " + match + "_");
		const res = await Google(match);
		return await msg.edit(res);
	},
);

Module(
	{
		pattern: "onwa ?(.*)",
		fromMe: mode,
		desc: "Checks if a number exists on WhatsApp",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.send("*Please provide a phone number.*");

		const phoneNumber = match.trim();
		const result = await onwhatsapp(phoneNumber);
		return await message.send(result, { quoted: message });
	},
);

Module(
	{
		pattern: "wiki ?(.*)",
		fromMe: mode,
		desc: "Search Wikipedia for a query",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendMessage("Please provide a search query.");
		const query = encodeURIComponent(match);
		const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`;
		const response = await getJson(url);
		if (response.type === "standard") {
			await message.send(`*Wikipedia result:*\n\nTitle: ${response.title}\n\n${response.extract}\n\nRead more: ${response.content_urls.desktop.page}`);
		} else {
			await message.send("No Wikipedia article found for your query.");
		}
	},
);

Module(
	{
		pattern: "movie ?(.*)",
		fromMe: mode,
		desc: "Get movie information",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide a movie title.");
		const query = encodeURIComponent(match);
		const url = `http://www.omdbapi.com/?t=${query}&apikey=4fc4cf8c`;
		const response = await axios.get(url);
		const movie = response.data;
		if (movie.Response === "True") {
			await message.send(`*Title:* ${movie.Title}\n*Year:* ${movie.Year}\n*Genre:* ${movie.Genre}\n*Plot:* ${movie.Plot}\n*IMDB Rating:* ${movie.imdbRating}\n\n*More Info:* ${movie.Poster}`);
		} else {
			await message.send("Movie not found.");
		}
	},
);

Module(
	{
		pattern: "define ?(.*)",
		fromMe: mode,
		desc: "Get the definition of a word",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide a word to define.");

		const query = encodeURIComponent(match);
		const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${query}`;
		const response = await axios.get(url);
		const definition = response.data[0];
		if (definition) {
			await message.send(`*Word:* ${definition.word}\n*Meaning:* ${definition.meanings[0].definitions[0].definition}\n*Example:* ${definition.meanings[0].definitions[0].example || "N/A"}`);
		} else {
			await message.send("Definition not found.");
		}
	},
);

Module(
	{
		pattern: "news ?(.*)",
		fromMe: mode,
		desc: "Get the latest news on a topic",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide a topic for news.");

		const query = encodeURIComponent(match);
		const url = `https://newsapi.org/v2/everything?q=${query}&apiKey=6798c308cb454b4cbba9af98ee488507&pageSize=1`;
		const response = await axios.get(url);
		const news = response.data.articles[0];
		if (news) {
			await message.send(`*Headline:* ${news.title}\n*Source:* ${news.source.name}\n*Published at:* ${news.publishedAt}\n\n${news.description}\n\nRead more: ${news.url}`);
		} else {
			await message.send("No news found for your query.");
		}
	},
);

Module(
	{
		pattern: "lyrics2 ?(.*)",
		fromMe: mode,
		desc: "Search for song lyrics",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Please provide a song title or artist._");

		const query = encodeURIComponent(match);
		const url = `https://api.lyrics.ovh/v1/${query}`;
		const response = await axios.get(url);
		if (response.data.lyrics) {
			await message.send(`*Lyrics:*\n\n${response.data.lyrics}`);
		} else {
			await message.send("Lyrics not found.");
		}
	},
);

Module(
	{
		pattern: "crypto ?(.*)",
		fromMe: mode,
		desc: "Get current price of a cryptocurrency",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide a cryptocurrency symbol (e.g., bitcoin, ethereum).");
		const query = encodeURIComponent(match.toLowerCase());
		const url = `https://api.coingecko.com/api/v3/simple/price?ids=${query}&vs_currencies=usd`;
		const response = await axios.get(url);
		const priceData = response.data;
		if (priceData[query]) {
			await message.send(`*${match.toUpperCase()} Price:* $${priceData[query].usd}`);
		} else {
			await message.send("Cryptocurrency not found.");
		}
	},
);

Module(
	{
		pattern: "anime ?(.*)",
		fromMe: mode,
		desc: "Search for anime information",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide an anime title.");

		const query = encodeURIComponent(match);
		const url = `https://api.jikan.moe/v4/anime?q=${query}&limit=1`;
		const response = await axios.get(url);
		const anime = response.data.data[0];
		if (anime) {
			await message.send(`*Title:* ${anime.title}\n*Episodes:* ${anime.episodes}\n*Status:* ${anime.status}\n*Score:* ${anime.score}\n*Synopsis:* ${anime.synopsis}\n\n*More Info:* ${anime.url}`);
		} else {
			await message.send("Anime not found.");
		}
	},
);

Module(
	{
		pattern: "github ?(.*)",
		fromMe: mode,
		desc: "Search for a GitHub user",
		type: "search",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("Please provide a GitHub username.");

		const query = encodeURIComponent(match);
		const url = `https://api.github.com/users/${query}`;
		const response = await axios.get(url);
		const user = response.data;
		if (user) {
			await message.send(`*Name:* ${user.name || "N/A"}\n*Username:* ${user.login}\n*Bio:* ${user.bio || "N/A"}\n*Public Repos:* ${user.public_repos}\n*Followers:* ${user.followers}\n\n*Profile URL:* ${user.html_url}`);
		} else {
			await message.send("GitHub user not found.");
		}
	},
);

Module(
	{
		pattern: "cat",
		fromMe: mode,
		desc: "Get a random cat image",
		type: "search",
	},
	async message => {
		const url = `https://api.thecatapi.com/v1/images/search`;
		const response = await axios.get(url);
		const cat = response.data[0];
		if (cat) {
			await message.send(cat.url, "image", "Here's a random cat for you!");
		} else {
			await message.sendMessage("Could not fetch a cat image.");
		}
	},
);

Module(
	{
		pattern: "dog",
		fromMe: mode,
		desc: "Get a random dog image",
		type: "search",
	},
	async message => {
		const url = `https://dog.ceo/api/breeds/image/random`;
		const response = await axios.get(url);
		const dog = response.data.message;
		if (dog) {
			await message.sendFileFromUrl(dog, "image", "Here's a random dog for you!");
		} else {
			await message.sendMessage("Could not fetch a dog image.");
		}
	},
);
