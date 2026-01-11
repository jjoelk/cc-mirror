import readline from 'node:readline';

export const prompt = async (question: string, defaultValue?: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed.length > 0 ? trimmed : (defaultValue ?? ''));
    });
  });
};
