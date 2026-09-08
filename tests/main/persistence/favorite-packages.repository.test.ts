import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import {
  getFavoritePackages,
  setPackageFavorite
} from '@main/persistence/favorite-packages.repository'

describe('favorite-packages.repository', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns an empty set when nothing has been favorited', () => {
    expect(getFavoritePackages(db)).toEqual(new Set())
  })

  it('adds a package to the favorite set', () => {
    setPackageFavorite(db, 'com.example.app', true)
    expect(getFavoritePackages(db)).toEqual(new Set(['com.example.app']))
  })

  it('removes a package from the favorite set', () => {
    setPackageFavorite(db, 'com.example.app', true)
    setPackageFavorite(db, 'com.example.app', false)
    expect(getFavoritePackages(db)).toEqual(new Set())
  })

  it('does not error when favoriting the same package twice', () => {
    setPackageFavorite(db, 'com.example.app', true)
    setPackageFavorite(db, 'com.example.app', true)
    expect(getFavoritePackages(db)).toEqual(new Set(['com.example.app']))
  })

  it('does not error when un-favoriting a package that was never favorited', () => {
    setPackageFavorite(db, 'com.example.app', false)
    expect(getFavoritePackages(db)).toEqual(new Set())
  })

  it('tracks multiple packages independently', () => {
    setPackageFavorite(db, 'com.example.one', true)
    setPackageFavorite(db, 'com.example.two', true)
    setPackageFavorite(db, 'com.example.one', false)
    expect(getFavoritePackages(db)).toEqual(new Set(['com.example.two']))
  })
})
