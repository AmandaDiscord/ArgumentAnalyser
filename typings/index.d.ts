import Discord = require("discord.js");

type Argument = [ArgumentIndex, ArgumentResponse, ArgumentCriteria];
/**
 * Criteria "type" wildcards: %username, %name, %expected, %recieved.
 *
 * Criteria "undefined" wildcards: %username, %name.
 *
 * Criteria "undiscoverable" wildcards: %data.
 *
 * Criteria "unviewable" wildcards: %username.
 */
type ArgumentCriteria = "type" | "undefined" | "undiscoverable" | "unviewable";
interface ArgumentResponse extends string {};
interface ArgumentIndex extends number {};

interface AnalyserData {
	message: Discord.Message;
	/**
	 * A string in the format of "\<arg1:Role\> [arg2:User]".
	 *
	 * Not type casting an argument assumes it is expected to be a string.
	 *
	 * Type casting an argument using quotation marks (" or ' or `) assumes the argument should be literal.
	 *
	 * Having a single argument have possible definitions of string and either of Role, Channel or User can break expected functionality causing it to default to string.
	 *
	 * <> = Required, [] = Optional, | = Or.
	 */
	definition: string;
	/**
	 * What the user actually passes split by a space or args formatted by `ArgumentAnalyser#formatArgs`.
	 */
	args: Array<string>;
	/**
	 * The expected user argument array length (total)
	 */
	length: number;
	findFunctions?: {
		user?(message: Discord.Message, string: string, self?: boolean): Discord.User | Promise<Discord.User>;
		member?(message: Discord.Message, string: string, self?: boolean): Discord.GuildMember | Promise<Discord.GuildMember>;
		channel?(message: Discord.Message, string: string, self?: boolean): (Discord.TextChannel | Discord.DMChannel) | Promise<Discord.TextChannel | Discord.DMChannel>;
		role?(message: Discord.Message, string: string): Discord.Role | Promise<Discord.Role>;
	};
}
interface AnalyserOptions {
	allowMultiErrors?: boolean;
	/**
	 * An array of arrays describing the index of the arg as it appears in the string and the string to use and the criteria to meet to use that string.
	 */
	responses?: Array<Argument>;
	checkViewable?: boolean;
	/**
	 * Whether the argument analyser should use functions to search for Users, GuildMembers, Roles and Channels.
	 * If this is true, you *have* to pass functions into AnalyserData#findFunctions
	 */
	search?: boolean;
}

declare class ArgumentAnalyser {
	constructor(data: AnalyserData, options?: AnalyserOptions);

	private _reportable: boolean;

	public message: Discord.Message;
	public definition: string;
	public input: Array<string>;
	public expectedLength: number;
	public responses: AnalyserOptions["responses"];
	public allowMultiErrors: boolean;
	public validating: boolean;
	public validated: boolean;
	public collected: Array<any>;
	public error: string;
	public findFunctions: AnalyserData["findFunctions"];
	public search: boolean;
	public checkViewable: boolean;

	private _end(validated: boolean): void;

	/**
	 * Formats arguments so that users can use a character (double and single quotation marks and template literals by default) to delimit a single argument.
	 * @param expression The expression to use to determine which character starts and ends an arg sequence.
	 * Must include a capture group which only returns the character used and include the g flag.
	 */
	public static format(args: Array<string>, expression?: RegExp): Array<string>;
	public validate(): Promise<void>;
}

exports = ArgumentAnalyser;
