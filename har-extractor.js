#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';

if (process.argv.length < 3) {
	console.log('Arguments: <file.har>...');
	process.exit(1);
}

for (const har_path of process.argv.slice(2)) {
	const dest = har_path.slice(0, har_path.lastIndexOf('.'));
	const har = JSON.parse(readFileSync(har_path));
	for (const entry of har.log.entries) {
		if (entry.request.method !== 'GET' || entry.response.status !== 200) {
			console.log(`Skipping: ${entry.request.method} ${entry.request.url} ${entry.response.status}`);
			continue;
		}
		let path = decodeURI(entry.request.url.slice(entry.request.url.indexOf('://') + 3).replace(/\?.*/, ''));
		mkdirSync(dest + '/' + path.slice(0, path.lastIndexOf('/')), { recursive: true });
		if (path.endsWith('/')) {
			path += '__' + encodeURIComponent(entry.response.headers.find((_) => _.name.toLowerCase() === 'content-type')?.value);
			console.log(`Using fallback for filename: ${path}`);
		}
		if (entry.response.content.text == null) {
			console.log(`No content: ${path}`);
			continue;
		}
		const content = Buffer.from(entry.response.content.text, entry.response.content.encoding);
		if (entry.response.content.size !== content.length) {
			console.log(`Mismatched size: ${path} (declared: ${entry.response.content.size}, actual: ${content.length})`);
		}
		writeFileSync(dest + '/' + path, content);
		const last_modified_header = entry.response.headers.find((_) => _.name.toLowerCase() === 'last-modified')?.value;
		if (last_modified_header) {
			utimesSync(dest + '/' + path, new Date(last_modified_header), new Date(last_modified_header));
		} else {
			console.log(`No Last-Modified header: ${path}`);
		}
	}
}
