export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // limite do bcrypt

interface PasswordRule {
  test: (password: string) => boolean;
  message: string;
}

const PASSWORD_RULES: PasswordRule[] = [
  {
    test: (p) => p.length >= MIN_PASSWORD_LENGTH,
    message: `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`,
  },
  {
    test: (p) => Buffer.byteLength(p, 'utf8') <= MAX_PASSWORD_LENGTH,
    message: `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres`,
  },
  {
    test: (p) => /[a-z]/.test(p),
    message: 'A senha deve conter pelo menos uma letra minúscula',
  },
  {
    test: (p) => /[A-Z]/.test(p),
    message: 'A senha deve conter pelo menos uma letra maiúscula',
  },
  {
    test: (p) => /\d/.test(p),
    message: 'A senha deve conter pelo menos um número',
  },
  {
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
    message: 'A senha deve conter pelo menos um caractere especial',
  },
  {
    test: (p) => !/\s/.test(p),
    message: 'A senha não pode conter espaços',
  },
];

/** Retorna a mensagem da primeira regra não atendida, ou null se a senha for válida. */
export function getPasswordPolicyError(password: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? failed.message : null;
}
