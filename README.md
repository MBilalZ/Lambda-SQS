````markdown
# bjjlink-recurring-payment-system

## Description

The **bjjlink-recurring-payment-system** is a Node.js application designed for managing recurring subscription payments using AWS Lambda. This system efficiently handles recurring payments by performing operations such as fetching, updating, and creating child transactions. The system is equipped to handle complex subscription intervals and payment schedules.

## Features

- **Fetch Transactions:** Retrieves pending transactions based on subscription schedules.
- **Create Transactions:** Creates new child transactions for recurring payments.
- **Update Transactions:** Updates existing transactions as needed.
- **Process Payments:** Ensures all transactions are processed according to the subscription intervals.

## Lambda Function

The core of the system is an AWS Lambda function that handles multiple events related to recurring payments. The Lambda function is triggered based on scheduled events and processes transactions accordingly.

### Events Handled

- **fetch-transaction:** Triggered to fetch pending transactions.
- **create-child-transaction:** Triggered to create new child transactions.
- **update-child-transaction:** Triggered to update existing child transactions.
- **future-transaction:** Handles transactions scheduled for future dates.

## Local Development

To run the system locally, ensure that you have the necessary environment variables configured. You will need `.env.development` for local development and `.env` for AWS Lambda deployment.

### Running Locally

1. **Install Dependencies:**

   ```bash
   npm install
   ```
````

2. **Start the Development Server:**

   ```bash
   npm start
   ```

   This command uses `nodemon` to watch for file changes and restarts the server automatically.

### Building the Code

- **Build the Project:**

  ```bash
  npm run build
  ```

  This command bundles the code using `esbuild` and outputs it to the `target` directory.

- **Build Lambda Package:**

  ```bash
  npm run build:lambda
  ```

  This command runs `build.js` to bundle and zip the Lambda function code for deployment.

## Deployment

For deployment, ensure that you package the Lambda function correctly and upload it to AWS Lambda. Ensure that all environment variables and configurations are correctly set for production.

## Author

**Bilal Zahid (Git)**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```

```
