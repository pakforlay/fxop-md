const { Module, mode, qrcode, isUrl, Bitly, removeBg, tinyurl, ssweb, shortenurl, upload, IronMan, ffmpeg, parseTimeToSeconds, convertImageBufferToPdf } = require("../lib");
const sharp = require("sharp");
const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../config");
const { fromBuffer } = require("file-type");

Module(
	{
		pattern: "qr ?(.*)",
		fromMe: mode,
		desc: "Read/Write Qr.",
		type: "tools",
	},
	async (message, match, m) => {
		match = match || message.reply_message?.text;
		if (match) {
			const buff = await qrcode(match);
			await message.send(buff, {}, "image");
		} else if (message.reply_message?.image) {
			const buffer = await m.quoted.download();
			const data = await readQr(buffer);
			await message.send(data);
		} else {
			await message.sendReply(`\`\`\`Wrong Format\`\`\`\n\n${message.prefix}qr (Replied Image)\n\n${message.prefix}qr (text)`);
		}
	},
);

Module(
	{
		pattern: "bitly ?(.*)",
		fromMe: mode,
		desc: "Converts Url to bitly",
		type: "tools",
	},
	async (message, match) => {
		match = match || message.reply_message.text;
		if (!match) return await message.reply("_Reply to a url or enter a url_");
		if (!isUrl(match)) return await message.reply("_Not a url_");
		const short = await Bitly(match);
		return await message.reply(short.link);
	},
);

Module(
	{
		pattern: "rmbg ?(.*)",
		fromMe: mode,
		desc: "Remove background of an image",
		type: "tools",
	},
	async (message, match, m) => {
		if (!config.RMBG_API_KEY) return await message.sendReply("_API key not Set!_");
		if (!message.reply_message?.image) return await message.reply("Reply to an image");
		const msg = await message.reply("_Processing Image!_");
		const buff = await m.quoted.download();
		const buffer = await removeBg(buff);
		await msg.edit("*_Operation Success_*");
		await message.send(buffer);
	},
);

Module(
	{
		pattern: "tinyurl ?(.*)",
		fromMe: mode,
		desc: "Shortens Link with TinyURL",
		type: "tools",
	},
	async (message, match) => {
		match = match || message.reply_message.text;
		if (!match) return await message.sendReply(`\`\`\`Wrong format\n\n${message.prefix}tinyurl URL\n\nOR REPLY A MESSAGE\`\`\``);
		if (!isUrl(match)) return await message.sendReply("_Invalid URL_");
		const msg = await message.reply("_Shortening Link_");
		const shortenText = await tinyurl(match);
		await msg.edit("*_Operation Success_*");
		return await message.send(shortenText);
	},
);

Module(
	{
		pattern: "ssweb ?(.*)",
		fromMe: mode,
		desc: "Screenshot Websites",
		type: "tools",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Provide URL_");
		if (!isUrl(match)) return await message.sendReply("_Not A URL_");
		const msg = await message.reply("_Processing URL_");
		const buff = await ssweb(match);
		await msg.edit("*_Success_*");
		return await message.send(buff);
	},
);

Module(
	{
		pattern: "slink ?(.*)",
		fromMe: mode,
		desc: "Shortens link URL",
		type: "tools",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Provide URL_");
		if (!isUrl(match)) return await message.sendReply("_Not A URL_");
		const msg = await message.reply("_Shortening Link_");
		const shortenedTxt = await shortenurl(match);
		await msg.edit("*_Success_*");
		return await message.send(shortenedTxt);
	},
);

Module(
	{
		pattern: "upload ?(.*)",
		fromMe: mode,
		desc: "Uploads Image",
		type: "tools",
	},
	async (message, match, m) => {
		if (!message.reply_message) return await message.reply("_Reply Image_");
		const msg = await message.reply("_Uploading File_");
		const buff = await m.quoted.download();
		const url = await upload(buff);
		return await msg.edit(`*IMAGE UPLOADED: ${url}*`);
	},
);

Module(
	{
		pattern: "time ?(.*)",
		fromMe: mode,
		desc: "Find Time",
		type: "tools",
	},
	async (message, match) => {
		if (!match) return await message.reply("*Need a place name to know time*\n_Example: .time japan_");
		var p = match.toLowerCase();
		const res = await fetch(IronMan(`ironman/search/time?loc=${p}`));
		const data = await res.json();
		if (data.error === "no place") return await message.send("_*No place found*_");
		const { name, state, tz, capital, currCode, currName, phone } = data;
		const now = new Date();
		const format12hrs = { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };
		const format24hrs = { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
		const time12 = new Intl.DateTimeFormat("en-US", format12hrs).formatToParts(now);
		const time24 = new Intl.DateTimeFormat("en-US", format24hrs).formatToParts(now);
		const milliseconds = now.getMilliseconds().toString().padStart(3, "0");
		let time12WithMs = "";
		time12.forEach(({ type, value }) => {
			if (type === "dayPeriod") {
				time12WithMs += `:${milliseconds} ${value}`;
			} else {
				time12WithMs += value;
			}
		});
		const time24WithMs = time24.map(({ value }) => value).join("") + `:${milliseconds}`;
		let msg = `*ᴄᴜʀʀᴇɴᴛ ᴛɪᴍᴇ*\n(12-hour format): ${time12WithMs}\n(24-hour format): ${time24WithMs}\n`;
		msg += `*ʟᴏᴄᴀᴛɪᴏɴ:* ${name}\n`;
		if (state) {
			msg += `*ꜱᴛᴀᴛᴇ:* ${state}\n`;
		}
		msg += `*ᴄᴀᴘɪᴛᴀʟ:* ${capital}\n`;
		msg += `*ᴄᴜʀʀᴇɴᴄʏ:* ${currName} (${currCode})\n`;
		msg += `*ᴘʜᴏɴᴇ ᴄᴏᴅᴇ:* +${phone}`;
		await message.sendReply(msg);
	},
);

Module(
	{
		pattern: "wame ?(.*)",
		fromMe: mode,
		desc: "wame generator",
		type: "tools",
	},
	async (message, match) => {
		if (!message.quoted) return message.reply("_*Reply to a user*_");
		let sender = "https://wa.me/" + (message.reply_message.sender || message.mention[0] || message.text).split("@")[0];
		await message.reply(sender);
	},
);

Module(
	{
		pattern: "trim ?(.*)",
		fromMe: mode,
		desc: "Trim the video or audio",
		type: "tools",
	},
	async (message, match, m, client) => {
		if (!message.reply_message || (!message.reply_message.video && !message.reply_message.audio)) {
			return await message.sendMessage("Reply to a media file");
		}
		if (!match) return await message.sendMessage("Give the start and end time in this format: mm:ss|mm:ss");

		const [start, end] = match.split("|");
		if (!start || !end) return await message.sendMessage("Give the start and end time in this format: mm:ss|mm:ss");
		const buffer = await m.quoted.download();
		const startSeconds = parseTimeToSeconds(start);
		const endSeconds = parseTimeToSeconds(end);
		const duration = endSeconds - startSeconds;
		const ext = (await fromBuffer(buffer)).ext;
		const args = ["-ss", `${startSeconds}`, "-t", `${duration}`, "-c", "copy"];
		const trimmedBuffer = await ffmpeg(buffer, args, ext, ext);
		message.sendFile(trimmedBuffer);
	},
);

Module(
	{
		pattern: "resize ?(.*)",
		fromMe: mode,
		desc: "Resize an uploaded image",
		type: "tools",
	},
	async (message, match, m, client) => {
		const dimensions = match.split(" ");
		const width = parseInt(dimensions[0]);
		const height = parseInt(dimensions[1]);
		if (!m.quoted) return await message.reply("Please reply to an image.");
		const inputBuffer = await m.quoted.download();
		const outputBuffer = await sharp(inputBuffer).resize(width, height).toBuffer();
		await message.sendFile(outputBuffer);
	},
);

Module(
	{
		pattern: "topdf ?(.*)",
		fromMe: mode,
		desc: "Convert image to PDF",
		type: "tools",
	},
	async (message, match, m, client) => {
		let imageBuffer = await m.quoted.download();
		const result = await convertImageBufferToPdf(imageBuffer);
		return await message.sendFile(result);
	},
);

Module(
	{
		pattern: "fetch ?(.*)",
		fromMe: mode,
		desc: "Fetch data from an API",
		type: "tools",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Provide URL | API to fetch from_");
		const endpoint = match.trim();
		try {
			const response = await axios.get(endpoint);
			await message.send(JSON.stringify(response.data, null, 2));
		} catch (error) {
			await message.reply(`Error fetching data: ${error.message}`);
		}
	},
);

Module(
	{
		pattern: "scrape ?(.*)",
		fromMe: mode,
		desc: "Scrape data from a website",
		type: "tools",
	},
	async (message, match) => {
		if (!match) return await message.sendReply("_Provide URL_");
		const url = match.trim();
		try {
			const { data } = await axios.get(url);
			const $ = cheerio.load(data);
			const htmlStructure = $.html();
			let elements = [];
			$("*").each((i, el) => {
				const tag = $(el).prop("tagName");
				const content = $(el).text().trim();
				if (content) {
					elements.push(`${tag}: ${content}`);
				}
			});
			let scrapedData = elements.slice(0, 100).join("\n");
			await message.send(scrapedData || "No visible text found on the page.");
		} catch (error) {
			await message.reply(`Error scraping data: ${error.message}`);
		}
	},
);
