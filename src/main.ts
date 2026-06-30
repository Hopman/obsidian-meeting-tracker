import { Plugin, TFile, debounce } from 'obsidian';

const MARKER_START = '<!-- meetings:start -->';
const MARKER_END = '<!-- meetings:end -->';

export default class DailyMeetingsPlugin extends Plugin {
    private debouncedUpdate = debounce(
        () => this.updateTodaysMeetings(),
        1000,
        true
    );

    async onload() {
        this.addCommand({
            id: 'update-todays-meetings',
            name: "Update Today's Meetings",
            callback: () => this.updateTodaysMeetings(),
        });

        this.app.workspace.onLayoutReady(() => {
            this.debouncedUpdate();
        });

        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && this.isTodaysDailyNote(file)) {
                    this.debouncedUpdate();
                }
            })
        );

        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                if (this.isMeetingNote(file)) {
                    this.debouncedUpdate();
                }
            })
        );
    }

    onunload() {}

    private isoWeek(date: Date): number {
        // ISO 8601: week containing the first Thursday of the year is week 1
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    private formatYMD(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private getDailyNotePath(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const ww = String(this.isoWeek(date)).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${ww}/${y}-${m}-${d}.md`;
    }

    private isTodaysDailyNote(file: TFile): boolean {
        return file.path === this.getDailyNotePath();
    }

    private isMeetingNote(file: TFile): boolean {
        return this.app.metadataCache.getFileCache(file)?.frontmatter?.type === 'Meeting';
    }

    private frontmatterDateString(value: unknown): string {
        if (value instanceof Date) return this.formatYMD(value);
        return String(value ?? '');
    }

    private getMeetingsForToday(): TFile[] {
        const today = this.formatYMD(new Date());
        return this.app.vault
            .getMarkdownFiles()
            .filter((file) => {
                const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
                return (
                    fm?.type === 'Meeting' &&
                    this.frontmatterDateString(fm?.date) === today
                );
            })
            .sort((a, b) => a.stat.ctime - b.stat.ctime);
    }

    private isProcessed(file: TFile): boolean {
        const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.Processed;
        return value === true || value === 'true';
    }

    private generateBlock(meetings: TFile[]): string {
        const lines = meetings.map((file) => {
            const mark = this.isProcessed(file) ? '/' : ' ';
            return `- [${mark}] [[${file.basename}]]`;
        });
        return `${MARKER_START}\n${lines.join('\n')}\n${MARKER_END}`;
    }

    private applyBlock(
        content: string,
        block: string
    ): { result: string; changed: boolean } {
        const startIdx = content.indexOf(MARKER_START);
        const endIdx = content.indexOf(MARKER_END);

        if (startIdx === -1 || endIdx === -1) {
            // Markers missing — prepend block at top of file
            return { result: block + '\n' + content, changed: true };
        }

        const existing = content.slice(startIdx, endIdx + MARKER_END.length);
        if (existing === block) {
            return { result: content, changed: false };
        }

        return {
            result:
                content.slice(0, startIdx) +
                block +
                content.slice(endIdx + MARKER_END.length),
            changed: true,
        };
    }

    private async ensureFolderPath(filePath: string): Promise<void> {
        const folder = filePath.substring(0, filePath.lastIndexOf('/'));
        if (!folder) return;

        const parts = folder.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    async updateTodaysMeetings(): Promise<void> {
        const meetings = this.getMeetingsForToday();
        const block = this.generateBlock(meetings);
        const notePath = this.getDailyNotePath();
        const existing = this.app.vault.getAbstractFileByPath(notePath);

        if (!existing) {
            await this.ensureFolderPath(notePath);
            await this.app.vault.create(notePath, block + '\n');
            return;
        }

        if (!(existing instanceof TFile)) return;

        const content = await this.app.vault.read(existing);
        const { result, changed } = this.applyBlock(content, block);
        if (changed) {
            await this.app.vault.modify(existing, result);
        }
    }
}
