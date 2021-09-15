db = db.getSiblingDB('test');

db.createUser({
  user: "test",
  pwd: "test",
  roles: [
    {
      role: "userAdmin",
      db: "test"
    },
    "readWrite"
  ]
});