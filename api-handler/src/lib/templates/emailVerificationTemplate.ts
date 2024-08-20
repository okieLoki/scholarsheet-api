export const emailVerificationTemplate = (verificationURL: string) => `
 <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Scholar Sheet</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Arial, sans-serif;
                background-color: #f0f4f8;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .email-container {
                max-width: 600px;
                background-color: #ffffff;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
                margin: auto;
                text-align: center;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #007BFF;
                margin-bottom: 20px;
            }
            h1 {
                color: #2c3e50;
                font-size: 26px;
                margin-bottom: 20px;
            }
            p {
                color: #555;
                font-size: 16px;
                line-height: 1.8;
                margin-bottom: 30px;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #007BFF;
                color: #ffffff;
                text-decoration: none;
                border-radius: 50px;
                font-size: 16px;
                font-weight: bold;
                transition: background-color 0.3s ease;
            }
            a:link, a:visited, a:hover, a:active {
                color: #ffffff;
            }
            .button:hover {
                background-color: #0056b3;
            }
            .footer {
                margin-top: 40px;
                color: #95a5a6;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="logo">Scholar Sheet</div>
            <h1>Email Verification</h1>
            <p>Welcome to Scholar Sheet! We're excited to have you on board. Please click the button below to verify your email address and get started with all the amazing features we offer.</p>
            <a href="${verificationURL}" class="button">Verify Your Email</a>
            <div class="footer">
                <p>If you did not sign up for Scholar Sheet, you can safely ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
  `;
