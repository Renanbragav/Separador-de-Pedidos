import { VENDEDORES, ESTOQUE_USERS, ADMIN_USERS, UserRole, UserProfile } from '../types';

const PASSWORDS_STORAGE_KEY = 'expedicao_user_passwords_v1';
const CURRENT_USER_STORAGE_KEY = 'expedicao_current_user_v1';

function getInitialPasswords(): Record<string, string> {
  const defaults: Record<string, string> = {};

  ADMIN_USERS.forEach((name) => {
    defaults[name] = '1234';
  });

  VENDEDORES.forEach((name) => {
    defaults[name] = '1234';
  });

  ESTOQUE_USERS.forEach((name) => {
    defaults[name] = '1234';
  });

  try {
    const saved = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.error('Falha ao carregar senhas:', e);
  }

  try {
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(defaults));
  } catch (e) {
    console.error('Falha ao salvar senhas padrões:', e);
  }

  return defaults;
}

export class AuthStore {
  private static passwords: Record<string, string> = getInitialPasswords();

  public static getPassword(username: string): string {
    return this.passwords[username] || '1234';
  }

  public static getAllPasswords(): Record<string, string> {
    return { ...this.passwords };
  }

  public static verifyPassword(username: string, passwordInput: string): boolean {
    const stored = this.getPassword(username);
    return stored.trim() === passwordInput.trim();
  }

  public static verifyAdminPassword(passwordInput: string): boolean {
    if (!passwordInput || !passwordInput.trim()) return false;
    return ADMIN_USERS.some((adminName) =>
      this.verifyPassword(adminName, passwordInput)
    );
  }

  public static updatePassword(username: string, newPassword: string): void {
    this.passwords[username] = newPassword.trim();
    try {
      localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(this.passwords));
    } catch (e) {
      console.error('Erro ao salvar senha atualizada:', e);
    }
  }

  public static isAdmin(username: string): boolean {
    return (ADMIN_USERS as readonly string[]).includes(username);
  }

  public static getCurrentUser(): UserProfile {
    try {
      const saved = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && parsed.role) {
          return parsed as UserProfile;
        }
      }
    } catch (e) {
      console.error('Erro ao carregar usuário ativo:', e);
    }
    // Default: Renan as Admin
    return { role: 'admin', name: 'Renan' };
  }

  public static saveCurrentUser(user: UserProfile): void {
    try {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Erro ao persistir usuário ativo:', e);
    }
  }
}
