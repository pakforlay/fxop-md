const fs = require("fs").promises;
const path = require("path");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const modulesJS = async (directory, options = {}) => {
	const { recursive = false, ignoreErrors = false, fileFilter = file => path.extname(file).toLowerCase() === ".js", maxRetries = 3, retryDelay = 3000 } = options;

	const readDirRecursive = async dir => {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const files = await Promise.all(
			entries.map(async entry => {
				const res = path.resolve(dir, entry.name);
				return entry.isDirectory() && recursive ? readDirRecursive(res) : res;
			}),
		);
		return files.flat();
	};

	const loadModule = async (filePath, retries = 0) => {
		try {
			return require(filePath);
		} catch (error) {
			if (retries < maxRetries) {
				console.warn(`Retry ${retries + 1} for file ${filePath}`);
				await delay(retryDelay);
				return loadModule(filePath, retries + 1);
			}
			if (!ignoreErrors) {
				throw error;
			}
			console.error(`Failed to load module ${filePath} after ${maxRetries} retries:`, error);
			return null;
		}
	};

	const files = recursive ? await readDirRecursive(directory) : await fs.readdir(directory);
	const filteredFiles = files.filter(fileFilter);

	const modules = await Promise.all(
		filteredFiles.map(async file => {
			const filePath = path.isAbsolute(file) ? file : path.join(directory, file);
			return await loadModule(filePath);
		}),
	);

	return modules.filter(module => module !== null);
};

module.exports = { modulesJS };
