const { Module, mode, toPTT, twitter, getJson, IronMan, getBuffer, aptoideDl } = require("../lib");
const { ytPlay } = require("client");

const mimez = {
	apk: "application/vnd.android.package-archive",
	pdf: "application/pdf",
	zip: "application/zip",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	txt: "text/plain",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	csv: "text/csv",
	rar: "application/x-rar-compressed",
};

Module(
	{
		pattern: "mediafire ?(.*)",
		fromMe: mode,
		desc: "Downloading files_doc",
		type: "download",
	},
	async (message, match) => {
		const { mediafiredl } = require("../lib/");
		const got = require("got-cjs");
		if (!match) return await message.sendReply("_No Url Was Provided!_");
		const url = match.trim();
		if (!url || !/https?:\/\/(www\.)?mediafire\.com/.test(url)) return await message.reply(`\`\`\`${message.prefix}mediafire <media_url>\`\`\``);

		const msg = await message.reply("_downloading file..._");
		try {
			const next = await mediafiredl(url);
			if (!next.url) {
				return await message.reply("err");
			}
			const mime_naxor = mimez[next.ext.toLowerCase()] || `application/${next.ext}`;
			const fileStream = got.stream(next.url);
			await message.sendMessage(
				message.jid,
				fileStream,
				{
					mimetype: mime_naxor,
					filename: `${next.filename}.${next.ext}`,
					caption: `*⍈ — NAME*: ${next.filename}\n*⍈ — TYPE*: ${next.filetype}\n*⍈ — SIZE*: ${next.filesizeH}`,
				},
				"document",
			);
			await msg.edit("*_Done_*");
		} catch (err) {
			await msg.edit(`*_${err.message}_*`);
		}
	},
);

Module(
	{
		pattern: "fb ?(.*)",
		fromMe: mode,
		desc: "Download Facebook video",
		type: "download",
	},
	async (message, match, client) => {
		if (!match || !/^(https:\/\/)?(www\.)?facebook\.com\/[A-Za-z0-9_.]+/.test(match)) return await message.reply("_Need a valid Facebook URL_");
		const response = await getJson(IronMan(`ironman/dl/fb?url=${match}`));
		const buff = await getBuffer(response.ironman[0].url);
		await message.send(buff);
	},
);

Module(
	{
		pattern: "insta ?(.*)",
		fromMe: mode,
		desc: "Downloads Instagram Video",
		type: "download",
	},
	async (message, match, client) => {
		if (!match || !/^(https:\/\/)?(www\.)?instagram\.com\/(p|reel|stories|tv|[A-Za-z0-9_.]+)/.test(match)) return await message.reply("_Need a valid Instagram URL_");
		const msg = await message.reply(`Downloading ${match}`);
		const res = await getJson("https://api.guruapi.tech/insta/v1/igdl?url=" + match);
		const buff = await getBuffer(res.media[0].url);
		await msg.edit("*_Download Success_*");
		return await message.send(buff);
	},
);

/*Module(
	{
		pattern: "apk ?(.*)",
		fromMe: mode,
		desc: "Downloads and sends an app",
		type: "download",
	},
	async (message, match) => {
		const appId = match;
		if (!appId) return await message.reply(`\`\`\`Wrong format\n\n${message.prefix}apk FreeFire\`\`\``);
		const msg = await message.reply("_Downloading " + match + "_");
		const appInfo = await aptoideDl(appId);
		const buff = await getBuffer(appInfo.link);
		await msg.edit("*_Download Success_*");
		await message.sendMessage(message.jid, buff, { mimetype: "application/vnd.android.package-archive", filename: `${appId.appname}.apk`, caption: match }, "document");
	},
);
*/

Module(
	{
		pattern: "apk ?(.*)",
		fromMe: mode,
		desc: "Downloads and sends an app",
		type: "download",
	},
	async (message, match) => {
		const appId = match.trim();
		if (!appId) return await message.reply(`\`\`\`Wrong format\n\n${message.prefix}apk FreeFire\`\`\``);
		const msg = await message.reply("_Downloading " + appId + "_");
		try {
			const appInfo = await aptoideDl(appId);
			const buff = await getBuffer(appInfo.link);
			if (!buff || !appInfo.appname) {
				return await msg.edit("*_err_*");
			}
			await message.sendMessage(
				message.jid,
				buff,
				{
					mimetype: "application/vnd.android.package-archive",
					filename: `${appInfo.appname}.apk`,
					caption: `By fxop-md: ${appInfo.appname}`,
				},
				"document",
			);
			await msg.edit("*_Download Success_*");
		} catch (err) {
			await msg.edit(err.message + "_*");
		}
	},
);

Module(
	{
		pattern: "spotify ?(.*)",
		fromMe: mode,
		desc: "Downloads song from Spotify",
		type: "download",
	},
	async (message, match) => {
		if (!match || !/^(https:\/\/)?(open\.)?spotify\.com\/[A-Za-z0-9_.\/?=]+/.test(match)) return await message.reply("_Need a valid Spotify URL_");
		const { link } = await getJson(IronMan(`ironman/dl/spotify?link=${match}`));
		const buff = await toPTT(await getBuffer(link));
		await message.send(buff);
	},
);

Module(
	{
		pattern: "twitter ?(.*)",
		fromMe: mode,
		desc: "Download Twitter media",
		type: "download",
	},
	async (message, match) => {
		if (!match || !/^(https:\/\/)?(www\.)?(twitter|x)\.com\/[A-Za-z0-9_]+/.test(match)) return await message.reply("_Need a valid X (Twitter) URL_");
		const msg = await message.reply("*_Downloading_*");
		const buff = await twitter(match);
		await msg.edit("*_Download Success_*");
		await message.send(buff);
	},
);

Module(
	{
		pattern: "video ?(.*)",
		fromMe: mode,
		desc: "Fetches Video",
		type: "download",
	},
	async (message, match) => {
		if (!match[1]) return message.sendReply(`\`\`\`Wrong Usage\n\n${message.prefix}video Just the two of us\`\`\``);
		const msg = await message.reply("*_Searching_*");
		const { video } = await ytPlay(match);
		await msg.edit(`*_Download Success_*`);
		await message.send(video);
	},
);

Module(
	{
		pattern: "play ?(.*)",
		fromMe: mode,
		desc: "Fetches Music",
		type: "download",
	},
	async (message, match) => {
		if (!match[1]) return message.sendReply(`\`\`\`Wrong Usage\n\n${message.prefix}play StarMan\`\`\``);
		const msg = await message.reply("*_Downloading_*");
		const { video } = await ytPlay(match);
		const audio = await toPTT(video, "mp3");
		await msg.edit(`*_Download Successful_*`);
		await message.send(audio);
	},
);

Module(
	{
		pattern: "ytv ?(.*)",
		fromMe: mode,
		desc: "Downloads Youtube Videos From URL",
		type: "download",
	},
	async (message, match, client) => {
		if (!match || !/^(https:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(match)) {
			return await message.reply("_Need a valid YouTube URL_");
		}
		const msgdl = await message.reply("_Downloading " + match + "_");
		const res = await getJson("https://api.guruapi.tech/ytdl/ytmp4?url=" + match);
		const buff = await getBuffer(res.video_url);
		await msgdl.edit(`_Successfully Downloaded ${res.title}_`);
		return await message.send(buff, { caption: res.description });
	},
);

Module(
	{
		pattern: "yta ?(.*)",
		fromeMe: mode,
		desc: "Downloads Youtube Audio From URL",
		type: "download",
	},
	async (message, match, client) => {
		if (!match || !/^(https:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(match)) {
			return await message.reply("_Need a valid YouTube URL_");
		}
		const msgdl = await message.reply("_Downloading " + match + "_");
		const res = await getJson("https://api.guruapi.tech/ytdl/ytmp4?url=" + match);
		const buff = await getBuffer(res.audio_url);
		await msgdl.edit(`_Successfully Downloaded ${res.title}\n${res.author}_`);
		return await message.send(buff);
	},
);
