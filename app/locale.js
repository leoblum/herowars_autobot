const fs = require('fs').promises
const path = require('path')
const utils = require('./utils')

class Locale {
  constructor () {
    this.locale = null

    this.patterns = {
      stamina: 'LIB_PSEUDO_STAMINA',
      gold: 'LIB_PSEUDO_COIN',
      experience: 'LIB_PSEUDO_XP',
      starmoney: 'LIB_PSEUDO_STARMONEY',
      dungeonActivity: 'LIB_PSEUDO_DUNGEON_ACTIVITY',
      consumable: 'LIB_CONSUMABLE_NAME_{ID}',
      coin: 'LIB_COIN_NAME_{ID}',
      fragmentHero: 'LIB_HERO_NAME_{ID} LIB_INVENTORYITEM_TYPE_HERO_FRAGMENT',
      fragmentArtifact: 'LIB_ARTIFACT_NAME_{ID} LIB_INVENTORYITEM_TYPE_FRAGMENT',
      fragmentGear: 'LIB_GEAR_NAME_{ID} LIB_INVENTORYITEM_TYPE_FRAGMENT',
      gear: 'LIB_GEAR_NAME_{ID}',
      fragmentScroll: 'LIB_SCROLL_NAME_{ID} LIB_INVENTORYITEM_TYPE_FRAGMENT',
      fragmentTitanArtifact: 'LIB_TITAN_ARTIFACT_NAME_{ID} LIB_INVENTORYITEM_TYPE_FRAGMENT',
      fragmentTitan: 'LIB_HERO_NAME_{ID} LIB_INVENTORYITEM_TYPE_HERO_FRAGMENT',
    }
  }

  async prepare () {
    let localeFile = path.join(path.dirname(__filename), 'locale_en.json')
    this.locale = await fs.readFile(localeFile, {encoding: 'utf8'})
    this.locale = JSON.parse(this.locale)
  }

  replace (pattern, tokens) {
    pattern = `{VALUE} ${pattern}`.toUpperCase()
    for (let [k, v] of Object.entries(tokens)) pattern = pattern.replace(`{${k.toUpperCase()}}`, v)
    pattern = pattern.split(' ').map(item => item in this.locale ? this.locale[item] : item)
    return pattern.join(' ')
  }

  reward (reward) {
    let patterns = this.patterns
    let strings = []

    for (let [k, v] of Object.entries(reward)) {
      let pattern = patterns[k]
      if (!pattern) {
        console.log(`!!! Reward type %s does not have handler`, k, JSON.stringify(reward, null, 2))
        continue
      }

      if (!utils.isObject(v)) v = {v}
      for (let [id, value] of Object.entries(v)) strings.push(this.replace(pattern, {value, id}))
    }

    return strings.join('; ')
  }
}

module.exports = Locale
