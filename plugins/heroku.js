const got = require("got-cjs");
const Heroku = require("heroku-client");
const Config = require("../config");
const { Module } = require("../lib");
const heroku = new Heroku({ token: Config.HEROKU_API_KEY });
const baseURI = "/apps/" + Config.HEROKU_APP_NAME;

function secondsToHms(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;

	return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

if (Config.HEROKU_API_KEY && Config.HEROKU_APP_NAME) {
	Module(
		{
			pattern: "reboot",
			desc: "Restart Dyno",
			type: "heroku",
		},
		async (message, match) => {
			await message.send(`_Restarting_`);
			await heroku.delete(baseURI + "/dynos").catch(async error => {
				await message.send(`HEROKU : ${error.body.message}`);
			});
		},
	);

	Module(
		{
			pattern: "offdyno",
			desc: "Dyno off",
			type: "heroku",
		},
		async (message, match) => {
			await heroku
				.get(baseURI + "/formation")
				.then(async formation => {
					await message.send(`_Shutting down._`);
					await heroku.patch(baseURI + "/formation/" + formation[0].id, {
						body: {
							quantity: 0,
						},
					});
				})
				.catch(async error => {
					await message.send(`HEROKU : ${error.body.message}`);
				});
		},
	);

	Module(
		{
			pattern: "dyno",
			desc: "Show Quota info",
			type: "heroku",
		},
		async (message, match) => {
			try {
				heroku
					.get("/account")
					.then(async account => {
						const url = `https://api.heroku.com/accounts/${account.id}/actions/get-quota`;
						const headers = {
							"User-Agent": "Chrome/80.0.3987.149 Mobile Safari/537.36",
							"Authorization": "Bearer " + Config.HEROKU_API_KEY,
							"Accept": "application/vnd.heroku+json; version=3.account-quotas",
						};
						const res = await got(url, { headers });
						const resp = JSON.parse(res.body);
						const total_quota = Math.floor(resp.account_quota);
						const quota_used = Math.floor(resp.quota_used);
						const remaining = total_quota - quota_used;
						const quota = `Total Quota : ${secondsToHms(total_quota)}
Used  Quota : ${secondsToHms(quota_used)}
Remaining   : ${secondsToHms(remaining)}`;
						await message.send("```" + quota + "```");
					})
					.catch(async error => {
						return await message.send(`HEROKU : ${error.body.message}`);
					});
			} catch (error) {
				await message.send(error);
			}
		},
	);
}

module.exports = {
	secondsToHms,
};
