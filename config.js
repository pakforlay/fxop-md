const { Sequelize } = require("sequelize");
require("dotenv").config();
const toBool = x => (x && x.toLowerCase() === "true") || false;
const DATABASE_URL = process.env.DATABASE_URL || "./db.sqlite3";
const isPostgres = DATABASE_URL.startsWith("postgresql://");
module.exports = {
	DATABASE_URL: DATABASE_URL,
	DATABASE: isPostgres
		? new Sequelize(DATABASE_URL, {
				dialect: "postgres",
				ssl: true,
				protocol: "postgres",
				dialectOptions: {
					native: true,
					ssl: { require: true, rejectUnauthorized: false },
				},
				logging: false,
		  })
		: new Sequelize({
				dialect: "sqlite",
				storage: DATABASE_URL,
				logging: false,
		  }),
	SESSION_ID: (process.env.SESSION_ID || "").trim(),
	BOT_INFO: process.env.BOT_NAME || "Astro;FxBot;https://f.uguu.se/qHMqiARV.jpg",
	SUDO: process.env.SUDO || "912345678909",
	HANDLERS: process.env.HANDLER === "false" || process.env.HANDLER === "null" ? "^" : ".",
	WELCOME_MSG: process.env.WELCOME_MSG || "Hi @user Welcome to @gname",
	GOODBYE_MSG: process.env.GOODBYE_MSG || "Hi @user It was Nice Seeing you",
	ANTILINK: process.env.ANTILINK || false,
	AUTO_REACT: process.env.AUTO_REACT || false,
	AUTO_READ: toBool(process.env.AUTO_READ) || false,
	AUTO_STATUS_READ: toBool(process.env.AUTO_STATUS_READ) || false,
	STICKER_PACK: process.env.AUTHOR || "Astro;FXBOTTO",
	LOGS: toBool(process.env.LOGS) || false,
	WORK_TYPE: process.env.WORK_TYPE || "private",
	BRANCH: "master",
	WARN_COUNT: 3,
	RMBG_API_KEY: process.env.RMBG_API_KEY || "",
	DELETED_LOG: toBool(process.env.DELETED_LOG) || false,
	DELETED_LOG_CHAT: toBool(process.env.DELETED_LOG_CHAT) || false,
	TIME_ZONE: process.env.TZ,
	VERSION: require("./package.json").version,
};
