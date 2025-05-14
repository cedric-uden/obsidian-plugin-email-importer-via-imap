import {config} from './config';
import ImapClient from "./client";


const client = new ImapClient(config);
client.connect();
client.fetch().then(
    (emailInfos) => {
        console.log('Fetched emails:', emailInfos);
    }
).catch((err) => {
        console.error('Error fetching emails:', err);
    }
);


client.getAvailableMailboxes().then(
    (mailboxes) => {
        console.log('Available mailboxes:', mailboxes);
        client.terminate();
    }
).catch((err) => {
        console.error('Error fetching mailboxes:', err);
        client.terminate();
    }
)
