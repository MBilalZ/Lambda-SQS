const lambdaTester = require('lambda-tester');
const readline = require('readline');
const myHandler = require('./target').handler;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt user and handle testing
function promptAndTest() {
  rl.question(
    'Enter the event name (or type "exit" to quit): ',
    (eventName) => {
      if (eventName.toLowerCase() === 'exit') {
        console.log('Exiting...');
        rl.close();
        return;
      }

      rl.question('Enter the event data in JSON format: ', (eventData) => {
        let event;
        try {
          // Parse user input
          event = JSON.parse(eventData);

          // Add the event type
          event.type = eventName;
        } catch (e) {
          console.error('Invalid JSON format. Please try again.');
          promptAndTest();
          return;
        }

        // Test the Lambda function with the provided event
        lambdaTester(myHandler)
          .event(event)
          .timeout(100)
          .expectResult((result) => {
            console.log('Result:', result);
            // Continue prompting for the next event
            promptAndTest();
          })
          .catch((err) => {
            console.error('Error:', err);
            // Continue prompting for the next event
            promptAndTest();
          });
      });
    }
  );
}

// Start the loop
promptAndTest();

// Handle Ctrl+C to exit gracefully
rl.on('SIGINT', () => {
  console.log('\nGracefully shutting down from SIGINT (Ctrl+C)');
  rl.close();
  process.exit(0);
});
