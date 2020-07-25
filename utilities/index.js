/**
 * A function to replace wildcard (%string) strings with information
 * @param {any} string The string
 * @param {{[x: string]: any}} properties example: `{ "username": "PapiOphidian" }`
 */
function replace(string, properties = {}) {
	/**
	 * @type {string}
	 */
	let value = string.slice(0, string.length);
	Object.keys(properties).forEach(item => {
		let index;
		while ((index = value.indexOf(`%${item}`)) !== -1) {
			value = value.slice(0, index) + properties[item] + value.slice(index + item.length + 1);
		}
	});
	return value;
}

module.exports = {
	replace
};
