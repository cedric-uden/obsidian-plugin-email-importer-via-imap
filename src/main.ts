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
