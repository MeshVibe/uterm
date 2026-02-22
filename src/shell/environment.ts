import path from 'node:path';

class Environment {
  private env: Record<string, string>;
  private cwd: string;
  private oldPwd: string;

  constructor() {
    this.env = { ...process.env } as Record<string, string>;
    this.cwd = process.cwd();
    this.oldPwd = this.cwd;
  }

  getCwd(): string {
    return this.cwd;
  }

  setCwd(dir: string): void {
    const resolved = path.resolve(this.cwd, dir);
    process.chdir(resolved);
    this.oldPwd = this.cwd;
    this.cwd = resolved;
    this.env['OLDPWD'] = this.oldPwd;
    this.env['PWD'] = this.cwd;
    process.env['OLDPWD'] = this.oldPwd;
    process.env['PWD'] = this.cwd;
  }

  getOldPwd(): string {
    return this.oldPwd;
  }

  getEnv(): Record<string, string> {
    return this.env;
  }

  getVar(key: string): string | undefined {
    return this.env[key];
  }

  setEnv(key: string, value: string): void {
    this.env[key] = value;
    process.env[key] = value;
  }

  unsetEnv(key: string): void {
    delete this.env[key];
    delete process.env[key];
  }
}

export const environment = new Environment();
