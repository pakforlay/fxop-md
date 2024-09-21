const axios = require("axios");

class Render {
	constructor(apiKey, serviceName) {
		this.apiKey = apiKey;
		this.serviceName = serviceName;
		this.baseURL = "https://api.render.com/v1";
	}

	async _makeRequest(method, endpoint, data = null) {
		try {
			const response = await axios({
				method,
				url: `${this.baseURL}${endpoint}`,
				headers: {
					"Authorization": `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				data,
			});
			return response.data;
		} catch (error) {
			throw new Error(`Render API Error: ${error.response?.data?.message || error.message}`);
		}
	}

	async getServiceId() {
		const services = await this._makeRequest("GET", "/services");
		const service = services.find(s => s.name === this.serviceName);
		if (!service) {
			throw new Error(`Service "${this.serviceName}" not found`);
		}
		return service.id;
	}

	async setVar(key, value) {
		const serviceId = await this.getServiceId();
		const envVars = await this._makeRequest("GET", `/services/${serviceId}/env-vars`);

		const existingVar = envVars.find(v => v.key === key);
		if (existingVar) {
			await this._makeRequest("PUT", `/services/${serviceId}/env-vars/${existingVar.id}`, { value });
		} else {
			await this._makeRequest("POST", `/services/${serviceId}/env-vars`, { key, value });
		}
	}

	async getVar(key) {
		const serviceId = await this.getServiceId();
		const envVars = await this._makeRequest("GET", `/services/${serviceId}/env-vars`);
		return envVars.find(v => v.key === key) || null;
	}

	async delVar(key) {
		const serviceId = await this.getServiceId();
		const envVars = await this._makeRequest("GET", `/services/${serviceId}/env-vars`);
		const varToDelete = envVars.find(v => v.key === key);

		if (varToDelete) {
			await this._makeRequest("DELETE", `/services/${serviceId}/env-vars/${varToDelete.id}`);
			return true;
		}
		return false;
	}

	async allVar() {
		const serviceId = await this.getServiceId();
		return await this._makeRequest("GET", `/services/${serviceId}/env-vars`);
	}

	async deploy(clearCache = false) {
		const serviceId = await this.getServiceId();
		await this._makeRequest("POST", `/services/${serviceId}/deploys`, { clearCache });
	}

	async restart() {
		const serviceId = await this.getServiceId();
		await this._makeRequest("POST", `/services/${serviceId}/restart`);
	}
}

module.exports = Render;
