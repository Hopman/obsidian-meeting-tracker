import { Plugin, TFile, Notice, debounce } from 'obsidian';

const HEADING_RE = /^###[ \t]+Meetings[ \t]*$/m;
const NEXT_HEADING_RE = /^#{1,3}[ \t]+.*$/m;
const DAILY_NOTE_DATE_RE = /(\d{4}-\d{2}-\d{2})\.md$/;

export default class DailyMeetingsPlugin extends Plugin {
  private debouncedUpdaters = new Map<string, () => void>();

  async onload() {
    this.addCommand({
      id: 'update-current-daily-meetings',
      name: 'Update Meetings in Current Daily Note',
      callback: () => this.updateCurrentDailyNote(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.getDebouncedUpdater(this.formatYMD(new Date()))();
    });

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        const date = file && this.resolveDailyNoteDate(file);
        if (date) this.getDebouncedUpdater(date)();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (!this.isMeetingNote(file)) return;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const date = this.frontmatterDateString(fm?.date);
        if (date) this.getDebouncedUpdater(date)();
      })
    );
  }

  onunload() { }

  private getDebouncedUpdater(date: string): () => void {
    let updater = this.debouncedUpdaters.get(date);
    if (!updater) {
      updater = debounce(() => this.updateMeetingsForDate(date), 1000, true);
      this.debouncedUpdaters.set(date, updater);
    }
    return updater;
  }

  private updateCurrentDailyNote(): void {
    const file = this.app.workspace.getActiveFile();
    const date = file && this.resolveDailyNoteDate(file);
    if (!date) {
      new Notice('Not a daily note — nothing to update.');
      return;
    }
    void this.updateMeetingsForDate(date);
  }

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

  private parseYMD(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  private getDailyNotePath(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const ww = String(this.isoWeek(date)).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${ww}/${y}-${m}-${d}.md`;
  }

  private resolveDailyNoteDate(file: TFile): string | null {
    const match = DAILY_NOTE_DATE_RE.exec(file.path);
    if (!match) return null;
    const dateStr = match[1];
    const date = this.parseYMD(dateStr);
    if (!date) return null;
    return file.path === this.getDailyNotePath(date) ? dateStr : null;
  }

  private isMeetingNote(file: TFile): boolean {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.type === 'Meeting';
  }

  private frontmatterDateString(value: unknown): string {
    if (value instanceof Date) return this.formatYMD(value);
    return String(value ?? '');
  }

  private getMeetingsForDate(date: string): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        return (
          fm?.type === 'Meeting' &&
          this.frontmatterDateString(fm?.date) === date
        );
      })
      .sort((a, b) => a.stat.ctime - b.stat.ctime);
  }

  private isProcessed(file: TFile): boolean {
    const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.Processed;
    return value === true || value === 'true';
  }

  private generateBlock(meetings: TFile[]): string {
    return meetings
      .map((file) => {
        const mark = this.isProcessed(file) ? '/' : ' ';
        return `- [${mark}] [[${file.basename}]]`;
      })
      .join('\n');
  }

  private buildSection(list: string): string {
    return list ? `### Meetings\n${list}\n` : '### Meetings\n';
  }

  private joinSection(section: string, rest: string, hasList: boolean): string {
    if (!rest) return section;
    return hasList ? section + '\n' + rest : section + rest;
  }

  private applyBlock(
    content: string,
    list: string
  ): { result: string; changed: boolean } | null {
    const headingMatch = HEADING_RE.exec(content);
    if (!headingMatch) return null;

    const startIdx = headingMatch.index;
    const headingLineEnd = startIdx + headingMatch[0].length;
    const afterHeading = content.slice(headingLineEnd);
    const nextHeadingMatch = NEXT_HEADING_RE.exec(afterHeading);
    const sectionEnd = nextHeadingMatch
      ? headingLineEnd + nextHeadingMatch.index
      : content.length;
    const rest = content.slice(sectionEnd);

    const result =
      content.slice(0, startIdx) +
      this.joinSection(this.buildSection(list), rest, list.length > 0);

    return { result, changed: result !== content };
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

  async updateMeetingsForDate(date: string): Promise<void> {
    const parsedDate = this.parseYMD(date);
    if (!parsedDate) return;

    const meetings = this.getMeetingsForDate(date);
    const list = this.generateBlock(meetings);
    const notePath = this.getDailyNotePath(parsedDate);
    const existing = this.app.vault.getAbstractFileByPath(notePath);

    if (!existing) {
      await this.ensureFolderPath(notePath);
      await this.app.vault.create(notePath, this.buildSection(list));
      return;
    }

    if (!(existing instanceof TFile)) return;

    const content = await this.app.vault.read(existing);
    const applied = this.applyBlock(content, list);
    const { result, changed } = applied ?? {
      result: this.joinSection(this.buildSection(list), content, list.length > 0),
      changed: true,
    };
    if (changed) {
      await this.app.vault.modify(existing, result);
    }
  }
}
