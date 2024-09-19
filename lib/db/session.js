const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;

const sequelize = new Sequelize({
	dialect: "sqlite",
	storage: path.join(__dirname, "auth.sqlite"),
	logging: false,
});

const AuthState = sequelize.define("AuthState", {
	key: {
		type: DataTypes.STRING,
		primaryKey: true,
	},
	value: {
		type: DataTypes.TEXT,
	},
});

async function initDB() {
	await sequelize.sync();
}

async function useCustomAuthState() {
	await initDB();

	const state = {
		creds: null,
		keys: {},
	};

	const saveCreds = async () => {
		await AuthState.upsert({
			key: "creds",
			value: JSON.stringify(state.creds),
		});
	};

	const getAuth = async () => {
		// Try to read creds from the database first
		const savedAuth = await AuthState.findAll();
		for (const row of savedAuth) {
			if (row.key === "creds") {
				state.creds = JSON.parse(row.value);
			} else {
				state.keys[row.key] = JSON.parse(row.value);
			}
		}

		// If creds are not in the database, try to read from creds.json
		if (!state.creds) {
			try {
				const credsPath = path.join(__dirname, "../../session/creds.json");
				const credsData = await fs.readFile(credsPath, "utf8");
				state.creds = JSON.parse(credsData);

				// Save the creds to the database for future use
				await saveCreds();
			} catch (error) {
				console.error("Error reading creds.json:", error);
				throw new Error("Failed to read credentials");
			}
		}

		return {
			state,
			saveCreds,
		};
	};

	return await getAuth();
}

module.exports = { useCustomAuthState };
