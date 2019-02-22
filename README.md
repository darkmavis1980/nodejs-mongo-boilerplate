# Express.js + MongoDB boilerplate

This is a simple Node.js boilerplate that uses Express.js, MongoDB with Mongoose, and it has a basic user model

## Docker

To start the server, and it's the first run, you need to build it first with:

```bash
docker-compose build
```

And then you can simply start it with:

```bash
docker-compose up
```

To access to the console of each container, you can run this command:

```bash
// access to the web container
$ docker-compose exec web /bin/bash

// access to the mongo container
$ docker-compose exec mongo /bin/bash
```

> Be aware that before you can start the server properly, you will need to install **npm dependencies** with `npm install`, and after you start it with **docker-compose** you will need to access to the mongo instance, add a user to the database you want to use, and then update the `config/docker.json` file (if you don't have it, just copy the `config/docker.sample.json` file).

---

### PM2 commands

PM2 has some handy commands to monitoring the server status, these ones are the most common, but you can type `sudo pm2 --help` to get the full list.

- `pm2 update` - Refresh and reload the current active instances
- `pm2 status` - It shows the current status of the PM2 instances
- `pm2 logs` - It shows the last 10 lines of each logs and a live stream of the logs generated in real time.
- `pm2 start <app.js> -i 0 --name "<app name>"` - Start an app using all CPUs available + set a name
- `pm2 stop <app name>` - Stops the app passed
- `pm2 delete <app name>` - Delete the passed app from PM2
- `pm2 start <app.js> -i <number of instances>` - Create an N number of instances for the server you want to start and activate a load balancer for it

---

## MongoDB

### Create admin user on MongoDB

If you wish to use a self hosted solution for MongoDB, remember that you need to create a MongoDB user and associate it with the database you want to use, here you can find a simple template of how to do it.

```
use <dbname>

db.createUser({
  user: "<username>",
  pwd: "<password>",
  roles: [
    {
      role: "userAdmin",
      db: "<dbname>"
    },
    "readWrite"
  ]
})
```

In case you never used the MongoDB shell, to run this code you simply have to run `mongo` in your terminal.

### Security

There are a couple of steps to make MongoDB secure from the default configuration, which is defined in the `/etc/mongod.conf` file.
One is to never allow `0.0.0.0` in the `bindIp` parameter, but just bind the ip you want to use to connect.
Also once you entered the user as shown above, to enable only the valid users to login into the db, you should add the following lines in the configuration file:

```yaml
security:
  authorization: enabled
```

This will tell to MongoDB to allow connections only with the valid users, and not to be open to the public as it's by default (and I don't understand why they do that).

### Backup and Restore with MongoDB

#### Create a backup

MongoDB comes with some utilities to easily make backups and restore data from a backup, the first one is `mongodump` (similar to *mysqldump*) and the second is `mongorestore`.
To create a backup the command is the following:

```
mongodump --out <path-to-backup-folder>
```

This will backup all the databases in the folder you passed in the arguments. If you want to backup one single database, you have to pass the `--db <dbname>` in the arguments. You can even trim down the backup to a single collection, just use the `--collection <collectionName>` attribute in addition to the others.
Here a few examples with all the cases:

```
// backup all the databases
mongodump --out /data/backup/

// backup only one database
mongodump --out /data/backup/ --db mydb

// backup only one collection of one database
mongodump --out /data/backup/ --db mydb --collection events

// backup only one database with authentication
mongodump --username <username> --password <password> --authenticationDatabase mydb --out /data/backup/ --db mydb
```

#### Restore a backup

Restoring the database is essentially the same, where the only difference is that the command is expecting at least a value, which is the path of the files to restore, so if we stored out backup files in the `/data/backup` folder, to restore anything it's in that path, you just have to run the following command:

```
mongorestore <path-to-backup-folder>
```

And if you want to restore one database, or even one collection of a database, it works exactly like the `mongodump` command, but here you can find some examples:

```
// restore all the databases
mongorestore /data/backup/

// restore only one database
mongorestore /data/backup/ --db mydb

// restore only one collection of one database
mongorestore /data/backup/ --db mydb --collection threads

//restore only one database with authentication
mongorestore /data/backup/ --username <username> --password <password> --authenticationDatabase mydb --db mydb
```

---

## Helpful links

* [nodemailer with Amazon SES](https://nodemailer.com/transports/ses/)
* [Install MongoDB on Ubuntu](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)
* [Install MongoDB on RedHat/Centos](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-red-hat/)
* [Install MongoDB on Amazon Linux](https://docs.mongodb.com/v3.4/tutorial/install-mongodb-on-amazon/)
* [How to Install MongoDB on Ubuntu 16.04](https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-16-04)
* [Robomongo - GUI for MongoDB on Mac](https://robomongo.org/download)
* [Backup And Restore with MongoDB](https://docs.mongodb.com/manual/tutorial/backup-and-restore-tools/)