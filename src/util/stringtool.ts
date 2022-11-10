export function formatBlock(str: string, items: { [key: string]: string }): string {
	for (const key of Object.keys(items)) {
		str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), items[key]);
	}
	return str;
};