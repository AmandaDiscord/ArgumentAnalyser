const Discord = require("discord.js");

const utils = require("./utilities");

const ArgExpression = /(["'`\w_ ]+):?(["'`\w_ ]*)?/;
const QuoteExpression = /(["'`])/g;
/**
 * @type {Array<[import("./typings").ArgumentCriteria, string]>}
 */
const defaultResponses = [
	["type", "%username, your argument %name did not match the proper type. Expected type %expected but got %received"],
	["undefined", "%username, you did not provide a %name argument and it is required."],
	["undiscoverable", "Unable to find %data"],
	["unviewable", "%username, I can't view that channel. To do anything, my permissions must be modified to view that channel"]
];

/**
 * @param {import("./typings").ArgumentCriteria} criteria
 * @param {Array<import("./typings").Argument>} responses
 */
function getResponse(criteria, responses) {
	if (Array.isArray(responses) && responses.length > 0) {
		const response = responses.find(item => item[2] == criteria)[1];
		if (response) return response;
		else return defaultResponses.find(item => item[0] == criteria)[1];
	} else return defaultResponses.find(item => item[0] == criteria)[1];
}

class ArgumentAnalyser {
	/**
	 * @param {import("./typings").AnalyserData} data
	 * @param {import("./typings").AnalyserOptions} [options]
	 */
	constructor(data, options = { allowMultiErrors: false, responses: [], checkViewable: false }) {
		this.msg = data.message;
		this.definition = data.definition;
		this.input = data.args;
		this.expectedLength = data.length;
		this.responses = options.responses;
		this.allowMultiErrors = options.allowMultiErrors || false;
		this.validating = true;
		this.validated = false;
		this.collected = [];
		/**
		 * @type {import("./typings").ArgumentResponse}
		 */
		this.error = "";
		this.findFunctions = data.findFunctions;
		this.search = options.search;
		this.checkViewable = options.checkViewable;
	}
	get usable() {
		if (this.validating) return false;
		if (!this.validated) return false;
		return true;
	}
	/**
	 * @private
	 */
	get _reportable() {
		if (this.error) {
			if (this.allowMultiErrors) return true;
			else return false;
		} else return true;
	}
	async validate() {
		// Build a tree of expected types based on definition.
		/** @type {Array<[number, string, string]>} */
		const expectedTypes = [];
		// copy definition.
		let typedef = this.definition.slice(0, this.definition.length);
		let argIndex = 0;
		while (argIndex < this.expectedLength) {
			// Is the current arg required?
			const isRequired = typedef[0] == "<";
			// Get the end of the arg definition.
			const typesEnd = typedef.indexOf(isRequired ? ">" : "]");
			// Get the type def for the arg not including the <> or [].
			const typesTotal = typedef.slice(1, typesEnd);
			// We have the def. Now, we can strip it out for the next pass.
			typedef = typedef.substring(typesTotal.length + 3);
			// Split by if an arg has multiple expected types
			const types = typesTotal.split(/ ?\| ?/);
			// Add it to an array of expected types for the argument.
			for (const arg of types) {
				const exparr = arg.match(ArgExpression);
				const matched = exparr[1].match(QuoteExpression);
				const literal = (matched && matched.filter(item => matched[0] == item).length > 1 ? true : false);
				const literalquote = literal ? matched[0] : null;
				// [index, name, type]
				if (typesTotal.includes("|") && !exparr[2]) {
					expectedTypes.push([
						argIndex,
						literal ? exparr[1].replace(new RegExp(literalquote, "g"), "") : exparr[1],
						literal ? "literal" : "string"
					]);
				} else expectedTypes.push([
					argIndex,
					literal ? exparr[1].replace(new RegExp(literalquote, "g"), "") : exparr[1],
					exparr[2] ? exparr[2] : (literal ? "literal" : "string")
				]);
			}

			// Do checks and conversions

			// Check if exists if it's required
			if (!this.input[argIndex] && isRequired) {
				this._end(false);
				if (this._reportable) {
					this.error = getResponse("undefined", this.responses);
					this.msg.channel.send(utils.replace(this.error, { "username": this.msg.author.username, "name": expectedTypes.find(item => item[0] == argIndex)[1] }));
				}
				return;
			}

			// Now we only have to check for if it actually exists
			if (this.input[argIndex]) {
				// get the arg, def name and it's def type
				const arg = this.input[argIndex];
				const [defname, deftypes] = [expectedTypes.find(item => item[0] == argIndex)[1], expectedTypes.filter(item => item[0] == argIndex).map(item => item[2])];
				let found = 0;

				// Check if it's primitive type matches or can be converted and matched.

				if (deftypes.includes("literal")) {
					if (expectedTypes.filter(item => item[0] == argIndex).map(item => item[1]).includes(arg)) {
						this.collected.push(arg);
						found = 1;
					}
				}

				if (deftypes.includes("string")) {
					if (!found) {
						this.collected.push(arg);
						found = 1;
					}
				}

				if (deftypes.includes("number")) {
					if (!found) {
						const num = Number(arg);
						if (!isNaN(num)) {
							this.collected.push(num);
							found = 1;
						}
					}
				}

				if (deftypes.includes("boolean")) {
					if (!found) {
						if (arg === "true" || arg === "false") {
							this.collected.push(arg === "true" ? true : false);
							found = 1;
						}
					}
				}

				if (deftypes.includes("Channel") && this.search) {
					if (!found) {
						const channel = await this.findFunctions.channel(this.msg, arg, isRequired ? false : true);
						let good = false
						if (channel) {
							if (this.checkViewable) {
								if (channel.type == "text" && channel.viewable) good = true;
								else if (channel.type == "dm") good = true;
								else {
									good = false
									if (this._reportable) {
										this.error = getResponse("unviewable", this.responses);
										this.msg.channel.send(utils.replace(this.error, { "username": this.msg.author.username }));
									}
								}
							} else good = true;
						}
						if (good) {
							this.collected.push(channel);
							found = 1;
						} else {
							if (this._reportable) {
								this.error = getResponse("undiscoverable", this.responses);
								this.msg.channel.send(utils.replace(this.error, { "data": `channel ${arg}` }));
							}
						}
					}
				}

				if (deftypes.includes("Role") && this.search) {
					if (!found) {
						const role = await this.findFunctions.role(this.msg, arg);
						if (role) {
							this.collected.push(role);
							found = 1;
						} else {
							if (this._reportable) {
								this.error = getResponse("undiscoverable", this.responses);
								this.msg.channel.send(utils.replace(this.error, { "data": `role ${arg}` }));
							}
						}
					}
				}

				if (deftypes.includes("User") && this.search) {
					if (!found) {
						let promise;
						if (this.msg.channel instanceof Discord.DMChannel) promise = this.findFunctions.user(this.msg, arg, isRequired ? false : true);
						else promise = this.findFunctions.member(this.msg, arg, isRequired ? false : true);
						let user = await promise;
						if (user instanceof Discord.GuildMember) user = user.user;
						if (user) {
							this.collected.push(user);
							found = 1;
						} else {
							if (this._reportable) {
								this.error = getResponse("undiscoverable", this.responses);
								this.msg.channel.send(utils.replace(this.error, { "data": `user ${arg}` }));
							}
						}
					}
				}

				if (!found) {
					this._end(false);
					if (this._reportable) {
						this.error = getResponse("type", this.responses);
						this.msg.channel.send(utils.replace(this.error, { "username": this.msg.author.username, "name": defname, "expected": deftypes.join(" or "), "received": arg }));
					}
				} else this._end(true);
			}

			argIndex++;
		}
	}
	/**
	 * @param {boolean} validated
	 * @private
	 */
	_end(validated) {
		this.validated = validated;
		this.validating = false;
	}
	/**
	 * Formats arguments so that users can use a character (double and single quotation marks and template literals by default) to delimit a single argument.
	 * @param {Array<string>} args
	 * @param {RegExp} [expression=/(["'`])/] The expression to use to determine which character starts and ends an arg sequence.
	 * Must include a capture group which only returns the character used and include the g flag.
	 */
	static format(args, expression = /(["'`])/g) {
		let argIndex = 0;
		let skip = [];
		const rebuilt = [];
		for (const arg of args) {
			if (skip.includes(argIndex)) {
				argIndex++;
				continue;
			}
			const exparr = arg.match(expression);
			if (exparr && exparr.filter(item => item == exparr[0]).length < 2) {
				const quote = exparr[0];
				const QuoteReg = new RegExp(quote, "g");
				let passing = true;
				let passingIndex = argIndex;
				let foundIndex = 0;
				while (passing) {
					const nextarg = args[passingIndex + 1];
					if (nextarg && nextarg.match(QuoteReg)) {
						foundIndex = passingIndex + 1;
						passing = false;
					}
					skip.push(passingIndex + 1);
					passingIndex++;
					if (!nextarg) {
						passing = false;
						skip = [];
					}
				}
				if (foundIndex != 0) {
					const newArg = args.slice(argIndex, foundIndex + 1).join(" ").replace(QuoteReg, "");
					rebuilt.push(newArg);
				} else rebuilt.push(arg);
			} else rebuilt.push(arg);
			argIndex++;
		}
		return rebuilt;
	}
}

module.exports = ArgumentAnalyser;
