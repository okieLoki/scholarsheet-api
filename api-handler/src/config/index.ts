import "dotenv/config";

class Config {
  public readonly PORT: number;
  public readonly DATABASE_URL: string;
  public readonly SMTP_USER: string;
  public readonly SMTP_PASS: string;
  public readonly JWT_SECRET: string;
  public readonly BASE_URL: string;
  public readonly LOG_LEVEL: string;
  public readonly RABBITMQ_URL: string;
  public readonly API_LIMIT: number = 50;

  constructor() {
    this.PORT = Number(process.env.PORT) || 8000;
    this.DATABASE_URL = process.env.DATABASE_URL || "";
    this.SMTP_USER = process.env.SMTP_USER || "";
    this.SMTP_PASS = process.env.SMTP_PASS || "";
    this.JWT_SECRET = process.env.JWT_SECRET || "";
    this.BASE_URL = process.env.BASE_URL || `http://localhost:${this.PORT}`;
    this.LOG_LEVEL = process.env.LOG_LEVEL || "info";
    this.RABBITMQ_URL = process.env.RABBITMQ_URL || "";
  }

  public verifyConfig(): void {
    const errors: string[] = [];

    const envVariables = [
      "DATABASE_URL",
      "SMTP_USER",
      "SMTP_PASS",
      "JWT_SECRET",
    ];

    envVariables.forEach((envVariable) => {
      if (!process.env[envVariable]) {
        errors.push(`Missing ${envVariable} in environment variables`);
      }
    });

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  }

}

export const config: Config = new Config();
