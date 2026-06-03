import { TFile, TFolder, Vault, normalizePath } from 'obsidian';

export class VaultUtils {
	/**
	 * Safely retrieves all markdown files within a specific folder (and its subfolders),
	 * completely bypassing the slow `vault.getMarkdownFiles()` vault-wide enumeration.
	 * 
	 * @param vault The Obsidian Vault instance
	 * @param folderPath The path to the folder (e.g., 'Tasks', 'Daily Notes', or '/' for root)
	 * @returns Array of TFile instances representing markdown files
	 */
	public static getMarkdownFilesInFolder(vault: Vault, folderPath: string, recursive: boolean = true): TFile[] {
		const files: TFile[] = [];
		const normalizedPath = folderPath === '/' || folderPath === '' ? '/' : normalizePath(folderPath);
		
		const abstractFile = vault.getAbstractFileByPath(normalizedPath);
		
		if (!abstractFile) {
			return files;
		}

		if (abstractFile instanceof TFile) {
			if (abstractFile.extension === 'md') {
				files.push(abstractFile);
			}
			return files;
		}

		if (abstractFile instanceof TFolder) {
			const recurse = (folder: TFolder) => {
				for (const child of folder.children) {
					if (child instanceof TFile && child.extension === 'md') {
						files.push(child);
					} else if (child instanceof TFolder && recursive) {
						recurse(child);
					}
				}
			};
			recurse(abstractFile);
		}
		
		return files;
	}
}
