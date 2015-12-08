import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { db } from '../src';
import config from './databases/config';
import * as helper from './databases/helper';
chai.use(chaiAsPromised);


const SUPPORTED_DB_CLIENTS = {
  mysql: {
    truncateTablesSQL: helper.readSQLScript('mysql'),
  },
  postgresql: {
    truncateTablesSQL: helper.readSQLScript('postgresql'),
  },
};


describe('db', () => {
  Object.keys(SUPPORTED_DB_CLIENTS).map(function testDBClient(dbClient) {
    const dbClientOpts = SUPPORTED_DB_CLIENTS[dbClient];

    describe(dbClient, () => {
      describe('.connect', () => {
        it(`should connect into a ${dbClient} database`, () => {
          const serverInfo = {
            ...config[dbClient],
            name: dbClient,
            client: dbClient,
          };
          const promise = db.connect(serverInfo, serverInfo.database);

          return expect(promise).to.not.be.rejected;
        });
      });

      describe('given is already connected', () => {
        const serverInfo = {
          ...config[dbClient],
          name: dbClient,
          client: dbClient,
        };

        beforeEach(() => {
          return db.connect(serverInfo, serverInfo.database);
        });

        describe('.listDatabases', () => {
          it('should list all databases', async () => {
            const databases = await db.listDatabases();
            expect(databases).to.include.members(['sqlectron']);
          });
        });

        describe('.listTables', () => {
          it('should list all tables', async () => {
            const tables = await db.listTables();
            expect(tables).to.eql([
              'roles',
              'users',
            ]);
          });
        });

        describe('.executeQuery', () => {
          const wrapQuery = require(`../src/db/clients/${dbClient}`).wrapQuery;

          beforeEach(() => {
            return Promise.all([
              db.executeQuery(`
                INSERT INTO ${wrapQuery('users')} (username, email, password)
                VALUES ('maxcnunes', 'maxcnunes@gmail.com', '123456')
              `),
              db.executeQuery(`
                INSERT INTO ${wrapQuery('roles')} (name)
                VALUES ('developer')
              `),
            ]);
          });

          afterEach(() => helper.truncateAllTables(serverInfo, dbClientOpts));

          it('should execute a single select query', async () => {
            const result = await db.executeQuery(`select * from ${wrapQuery('users')}`);
            expect(result).to.have.deep.property('fields[0].name').to.eql('id');
            expect(result).to.have.deep.property('fields[1].name').to.eql('username');
            expect(result).to.have.deep.property('fields[2].name').to.eql('email');
            expect(result).to.have.deep.property('fields[3].name').to.eql('password');

            expect(result).to.have.deep.property('rows[0].id').to.eql(1);
            expect(result).to.have.deep.property('rows[0].username').to.eql('maxcnunes');
            expect(result).to.have.deep.property('rows[0].password').to.eql('123456');
            expect(result).to.have.deep.property('rows[0].email').to.eql('maxcnunes@gmail.com');
          });

          it('should execute multiple select queries', async () => {
            const result = await db.executeQuery(`
              select * from ${wrapQuery('users')};
              select * from ${wrapQuery('roles')};
            `);

            expect(result).to.have.deep.property('fields[0][0].name').to.eql('id');
            expect(result).to.have.deep.property('fields[0][1].name').to.eql('username');
            expect(result).to.have.deep.property('fields[0][2].name').to.eql('email');
            expect(result).to.have.deep.property('fields[0][3].name').to.eql('password');

            expect(result).to.have.deep.property('rows[0][0].id').to.eql(1);
            expect(result).to.have.deep.property('rows[0][0].username').to.eql('maxcnunes');
            expect(result).to.have.deep.property('rows[0][0].password').to.eql('123456');
            expect(result).to.have.deep.property('rows[0][0].email').to.eql('maxcnunes@gmail.com');

            expect(result).to.have.deep.property('fields[1][0].name').to.eql('id');
            expect(result).to.have.deep.property('fields[1][1].name').to.eql('name');

            expect(result).to.have.deep.property('rows[1][0].id').to.eql(1);
            expect(result).to.have.deep.property('rows[1][0].name').to.eql('developer');
          });
        });
      });
    });
  });
});