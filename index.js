const StartApp = require("./lib/app");

const appInit = new StartApp();
appInit.initialize().then(() => {
	return true;
});
