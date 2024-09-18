/**
 * @fileoverview Module for defining and managing commands.
 * @module commandModule
 */

const config = require("../config");

/** @type {Array<CommandInfo>} */
const commands = [];

/**
 * Represents the structure of a command.
 * @typedef {Object} CommandInfo
 * @property {string} [pattern] - Regular expression pattern to match the command.
 * @property {string} [originalPattern] - Original pattern before conversion to RegExp.
 * @property {boolean} [dontAddCommandList=false] - Flag to exclude command from the list.
 * @property {boolean} [fromMe=false] - Flag to indicate if command is from the user.
 * @property {string} [type="misc"] - Type of the command.
 * @property {Function} function - Function to execute when command is triggered.
 */

/**
 * Define a command and store it in the commands array.
 * @function
 * @param {CommandInfo} commandInfo - Information about the command.
 * @param {Function} func - The function to execute when the command is triggered.
 * @returns {CommandInfo} - The processed command information.
 *
 * @example
 * const myCommand = Module({
 *   pattern: 'hello',
 *   type: 'greeting'
 * }, () => {
 *   console.log('Hello, world!');
 * });
 */
function Module(commandInfo, func) {
	commandInfo.function = func;
	if (commandInfo.pattern) {
		commandInfo.originalPattern = commandInfo.pattern;
		commandInfo.pattern = new RegExp(`^(${config.HANDLERS})\\s*(${commandInfo.pattern})(?:\\s+(.*))?$`, "i");
	}
	commandInfo.dontAddCommandList = commandInfo.dontAddCommandList || false;
	commandInfo.fromMe = commandInfo.fromMe || false;
	commandInfo.type = commandInfo.type || "misc";

	commands.push(commandInfo);
	return commandInfo;
}

module.exports = {
	Module,
	commands,
};
