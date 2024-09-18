const config = require("../../config");
const { DataTypes, Op } = require("sequelize");

const FiltersDB = config.DATABASE.define("filters", {
	chat: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	pattern: {
		type: DataTypes.TEXT,
		allowNull: false,
	},
	text: {
		type: DataTypes.TEXT,
		allowNull: false,
	},
	regex: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false,
	},
	caseSensitive: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false,
	},
	exactMatch: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false,
	},
	createdBy: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	createdAt: {
		type: DataTypes.DATE,
		defaultValue: DataTypes.NOW,
	},
});

async function getFilter(jid = null, filter = null) {
	const whereClause = { chat: jid };
	if (filter !== null) {
		whereClause.pattern = filter;
	}
	const filters = await FiltersDB.findAll({
		where: whereClause,
	});

	return filters.length > 0 ? filters : false;
}

async function setFilter(jid = null, filter = null, tex = null, regx = false, caseSensitive = false, exactMatch = false, createdBy = null) {
	const existingFilter = await FiltersDB.findOne({
		where: {
			chat: jid,
			pattern: filter,
		},
	});

	if (!existingFilter) {
		return await FiltersDB.create({
			chat: jid,
			pattern: filter,
			text: tex,
			regex: regx,
			caseSensitive: caseSensitive,
			exactMatch: exactMatch,
			createdBy: createdBy,
		});
	} else {
		return await existingFilter.update({
			chat: jid,
			pattern: filter,
			text: tex,
			regex: regx,
			caseSensitive: caseSensitive,
			exactMatch: exactMatch,
			createdBy: createdBy,
		});
	}
}

async function deleteFilter(jid = null, filter) {
	const existingFilter = await FiltersDB.findOne({
		where: {
			chat: jid,
			pattern: filter,
		},
	});

	if (!existingFilter) {
		return false;
	} else {
		return await existingFilter.destroy();
	}
}

async function searchFilters(searchTerm) {
	return await FiltersDB.findAll({
		where: {
			[Op.or]: [{ pattern: { [Op.like]: `%${searchTerm}%` } }, { text: { [Op.like]: `%${searchTerm}%` } }],
		},
	});
}

module.exports = {
	FiltersDB,
	getFilter,
	setFilter,
	deleteFilter,
	searchFilters,
};
