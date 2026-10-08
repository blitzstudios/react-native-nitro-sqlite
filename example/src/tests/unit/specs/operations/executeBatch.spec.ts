import { chance, expect, isNitroSQLiteError } from '../../common'
import type { BatchQueryCommand } from 'react-native-nitro-sqlite'
import { describe, it } from '../../../MochaRNAdapter'
import { testDb } from '../../../db'

export default function registerExecuteBatchUnitTests() {
  describe('executeBatch', () => {
    it('executeBatch', () => {
      const id1 = chance.integer()
      const name1 = chance.name()
      const age1 = chance.integer()
      const networth1 = chance.floating()

      const id2 = chance.integer()
      const name2 = chance.name()
      const age2 = chance.integer()
      const networth2 = chance.floating()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id1, name1, age1, networth1],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id2, name2, age2, networth2],
        },
      ]

      testDb.executeBatch(commands)

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        { id: id1, name: name1, age: age1, networth: networth1 },
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ])
    })

    it('Async batch execute', async () => {
      const id1 = chance.integer()
      const name1 = chance.name()
      const age1 = chance.integer()
      const networth1 = chance.floating()
      const id2 = chance.integer()
      const name2 = chance.name()
      const age2 = chance.integer()
      const networth2 = chance.floating()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id1, name1, age1, networth1],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id2, name2, age2, networth2],
        },
      ]

      await testDb.executeBatchAsync(commands)

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        { id: id1, name: name1, age: age1, networth: networth1 },
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ])
    })
    it('Failing batch surfaces the original error and rolls back once', () => {
      const id = chance.integer()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id, chance.name(), chance.integer(), chance.floating()],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id, chance.name(), chance.integer(), chance.floating()],
        },
      ]

      let error: unknown
      try {
        testDb.executeBatch(commands)
      } catch (e) {
        error = e
      }

      expect(isNitroSQLiteError(error)).to.equal(true)
      expect((error as Error).message).to.include('UNIQUE constraint failed')
      expect((error as Error).message).not.to.include('cannot rollback')
      expect(testDb.execute('SELECT * FROM User').rows?._array).to.eql([])
      // The handle is back in autocommit mode, so a new batch can begin.
      testDb.executeBatch([commands[0]!])
      expect(testDb.execute('SELECT * FROM User').rows?.length).to.equal(1)
    })

    it('Failing async batch surfaces the original error and rolls back once', async () => {
      const id = chance.integer()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id, chance.name(), chance.integer(), chance.floating()],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id, chance.name(), chance.integer(), chance.floating()],
        },
      ]

      let error: unknown
      try {
        await testDb.executeBatchAsync(commands)
      } catch (e) {
        error = e
      }

      expect(isNitroSQLiteError(error)).to.equal(true)
      expect((error as Error).message).to.include('UNIQUE constraint failed')
      expect((error as Error).message).not.to.include('cannot rollback')
      expect(testDb.execute('SELECT * FROM User').rows?._array).to.eql([])
      await testDb.executeBatchAsync([commands[0]!])
      expect(testDb.execute('SELECT * FROM User').rows?.length).to.equal(1)
    })
  })
}
