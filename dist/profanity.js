"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profanity = exports.Profanity = void 0;
const profanity_options_1 = require("./profanity-options");
const models_1 = require("./models");
const utils_1 = require("./utils");
const data_1 = require("./data");
class Profanity {
    constructor(options) {
        this.options = options ? { ...new profanity_options_1.ProfanityOptions(), ...options } : new profanity_options_1.ProfanityOptions();
        this.whitelist = new models_1.List(() => this.clearRegexes());
        this.blacklist = new models_1.List(() => this.clearRegexes());
        this.removed = new models_1.List(() => this.clearRegexes());
        this.regexes = new Map();
    }
    /**
     * Checks if the given text contains any profanity.
     * @param text - The text to check for profanity.
     * @param languages - Optional array of language codes to use for profanity detection.
     *                    If not provided, uses the languages specified in the options.
     * @returns True if profanity is found, false otherwise.
     */
    exists(text, languages) {
        if (typeof text !== "string") {
            return false;
        }
        const regex = this.getRegex(this.resolveLanguages(languages));
        regex.lastIndex = 0;
        const lowercaseText = text.toLowerCase();
        let match;
        while ((match = regex.exec(lowercaseText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            if (!this.isWhitelisted(matchStart, matchEnd, lowercaseText)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Censors profanity in the given text.
     * @param text - The text to censor.
     * @param censorType - The type of censoring to apply. Defaults to CensorType.Word.
     * @param languages - Optional array of language codes to use for profanity detection.
     *                    If not provided, uses the languages specified in the options.
     * @returns The censored text.
     */
    censor(text, censorType = models_1.CensorType.Word, languages) {
        if (typeof text !== "string") {
            return text;
        }
        const regex = this.getRegex(this.resolveLanguages(languages));
        regex.lastIndex = 0;
        const lowercaseText = text.toLowerCase();
        return this.replaceProfanity(text, lowercaseText, (word, start, end) => {
            if (this.isWhitelisted(start, end, lowercaseText)) {
                return word;
            }
            switch (censorType) {
                case models_1.CensorType.Word: {
                    const underscore = word.includes("_") ? "_" : "";
                    return this.options.grawlix + underscore;
                }
                case models_1.CensorType.WordLength: {
                    return new Array(word.length + 1).join(this.options.grawlixChar);
                }
                case models_1.CensorType.FirstChar:
                    return this.options.grawlixChar + word.slice(1);
                case models_1.CensorType.FirstVowel:
                case models_1.CensorType.AllVowels: {
                    const vowelRegex = new RegExp("[aeiou]", censorType === models_1.CensorType.FirstVowel ? "i" : "ig");
                    return word.replace(vowelRegex, this.options.grawlixChar);
                }
                default:
                    throw new Error(`Invalid replacement type: "${censorType}"`);
            }
        }, regex);
    }
    /**
     * Adds words to the profanity blacklist.
     * @param words - An array of words to add to the blacklist.
     */
    addWords(words) {
        const removedWords = [];
        const blacklistWords = [];
        words.forEach((word) => {
            const lowerCaseWord = word.toLowerCase();
            if (this.removed.words.has(lowerCaseWord)) {
                removedWords.push(lowerCaseWord);
            }
            else {
                blacklistWords.push(lowerCaseWord);
            }
        });
        if (removedWords.length) {
            this.removed.removeWords(removedWords);
        }
        if (blacklistWords.length) {
            this.blacklist.addWords(blacklistWords);
        }
    }
    /**
     * Removes words from the profanity blacklist.
     * @param words - An array of words to remove from the blacklist.
     */
    removeWords(words) {
        const blacklistedWords = [];
        const removeWords = [];
        words.forEach((word) => {
            const lowerCaseWord = word.toLowerCase();
            if (this.blacklist.words.has(lowerCaseWord)) {
                blacklistedWords.push(lowerCaseWord);
            }
            else {
                removeWords.push(lowerCaseWord);
            }
        });
        if (blacklistedWords.length) {
            this.blacklist.removeWords(blacklistedWords);
        }
        if (removeWords.length) {
            this.removed.addWords(removeWords);
        }
    }
    /**
     * Checks if a given match is whitelisted.
     * @param matchStart - The starting index of the match in the text.
     * @param matchEnd - The ending index of the match in the text.
     * @param text - The lowercase text being checked.
     * @returns True if the match is whitelisted, false otherwise.
     */
    isWhitelisted(matchStart, matchEnd, text) {
        for (const whitelistedWord of this.whitelist.words) {
            const whitelistedIndex = text.indexOf(whitelistedWord, Math.max(0, matchStart - whitelistedWord.length + 1));
            if (whitelistedIndex !== -1) {
                const whitelistedEnd = whitelistedIndex + whitelistedWord.length;
                if (this.options.wholeWord) {
                    if (matchStart === whitelistedIndex &&
                        matchEnd === whitelistedEnd &&
                        (matchStart === 0 || !/[\w-_]/.test(text[matchStart - 1])) &&
                        (matchEnd === text.length || !/[\w-_]/.test(text[matchEnd]))) {
                        return true;
                    }
                }
                else {
                    if ((matchStart >= whitelistedIndex && matchStart < whitelistedEnd) ||
                        (matchEnd > whitelistedIndex && matchEnd <= whitelistedEnd) ||
                        (whitelistedIndex >= matchStart && whitelistedEnd <= matchEnd)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * Replaces profanity in the text using the provided replacer function.
     * @param text - The original text.
     * @param lowercaseText - The lowercase version of the text.
     * @param replacer - A function that determines how to replace profane words.
     * @param regex - The regular expression used to find profane words.
     * @returns The text with profanity replaced.
     */
    replaceProfanity(text, lowercaseText, replacer, regex) {
        let result = text;
        let offset = 0;
        let match;
        while ((match = regex.exec(lowercaseText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            const originalWord = text.slice(matchStart + offset, matchEnd + offset);
            const censoredWord = replacer(originalWord, matchStart, matchEnd);
            result = result.slice(0, matchStart + offset) + censoredWord + result.slice(matchEnd + offset);
            offset += censoredWord.length - originalWord.length;
        }
        return result;
    }
    /**
     * Determines the list of languages to use, either from the provided list or falling back to default languages.
     * @param languages - An optional list of languages to use.
     * @returns The list of languages to be used.
     */
    resolveLanguages(languages) {
        return (languages === null || languages === void 0 ? void 0 : languages.length) ? languages : this.options.languages;
    }
    /**
     * Retrieves or constructs a regular expression for detecting profanity in the specified languages.
     * This method first checks if a regex for the given combination of languages already exists in the cache.
     *
     * @param languages - An array of languages to include in the regex.
     * @throws {Error} If no languages are provided.
     * @returns A RegExp object for detecting profanity in the specified languages.
     */
    getRegex(languages) {
        if (!languages.length) {
            throw new Error("At least one language must be provided");
        }
        const uniqueLanguages = [...new Set(languages.map((language) => language.trim().toLowerCase()))];
        const regexKey = uniqueLanguages.sort().join(",");
        if (this.regexes.has(regexKey)) {
            return this.regexes.get(regexKey);
        }
        const allWords = uniqueLanguages.flatMap((language) => {
            const words = data_1.profaneWords.get(language);
            if (!words) {
                throw new Error(`Invalid language: "${language}"`);
            }
            return words.filter((word) => !this.removed.words.has(word));
        });
        const regex = this.buildRegex(allWords);
        this.regexes.set(regexKey, regex);
        return regex;
    }
    /**
     * Constructs a regular expression for detecting profane words.
     *
     * @param words - An array of profane words to be included in the regex.
     * @returns A RegExp that matches any of the profane or blacklisted words.
     */
    buildRegex(words) {
        const allProfaneWords = [...words, ...this.blacklist.words];
        const escapedProfaneWords = allProfaneWords.map(utils_1.escapeRegExp);
        const profanityPattern = `${this.options.wholeWord ? "(?:\\b|_)" : ""}(${escapedProfaneWords.join("|")})${this.options.wholeWord ? "(?:\\b|_)" : ""}`;
        // eslint-disable-next-line security/detect-non-literal-regexp
        return new RegExp(profanityPattern, "gi");
    }
    /**
     * Clear the cached regexes.
     */
    clearRegexes() {
        this.regexes.clear();
    }
}
exports.Profanity = Profanity;
exports.profanity = new Profanity();
//# sourceMappingURL=profanity.js.map