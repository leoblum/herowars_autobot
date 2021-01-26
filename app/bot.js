const G = require('generatorics')
const API = require('./api')
const Locale = require('./locale')
const utils = require('./utils')

class Bot {
  constructor () {
    this.api = new API()
    this.locale = new Locale()
  }

  now () {
    return Math.floor(Date.now() / 1000)
  }

  async run () {
    try {
      await this.prepare()

      await this.farmMail()
      await this.farmQuests()
      await this.farmExpeditions()
      await this.farmDailyGifts()
      await this.farmDailyBonus()
      await this.farmValkyriesBonus()

      await this.api.getState()

    } catch (e) {
      if (!e instanceof API.APIError) throw e
      console.log('%s\n%s', e.stack, JSON.stringify(e.error, null, 2))
    }
  }

  findTeamForExpedition (heroes, minPower, teamSize = 5) {
    let bestTeam = null
    let bestPower = Number.MAX_SAFE_INTEGER

    for (let team of G.combination(heroes, teamSize)) {
      let p = utils.acc(team.map(item => item.power))
      if (p < minPower) continue
      if (p < bestPower) [bestTeam, bestPower] = [team.concat(), p]
    }
    return bestTeam
  }

  logReward (actionName, reward) {
    if (reward === null) return
    console.log(`${actionName} ${this.locale.reward(reward)}`)
  }

  async prepare () {
    await this.api.prepare()
    await this.locale.prepare()
  }

  async farmMail () {
    let letters = await this.api.getAllMail()
    if (letters.length === 0) return

    let lettersId = letters.map(letter => letter.id)
    let rewards = await this.api.farmMail(lettersId)
    for (let reward of rewards) this.logReward('Mail reward:', reward)
  }

  async farmQuests (quests = null) {
    if (quests !== null && quests.length === 0) return
    if (quests === null) quests = await this.api.getAllQuests()

    for (let quest of quests) {
      if (quest.state !== 2) continue

      let reward = await this.api.farmQuest(quest.id)
      this.logReward('Quest reward:', reward)
    }
  }

  async farmExpeditions () {
    let expeditions = await this.api.getExpeditions()

    let onGoing = expeditions.filter(item => item.status === 2 && item.endTime > this.now())
    let completed = expeditions.filter(item => item.status === 2 && item.endTime < this.now())
    let available = expeditions.filter(item => item.status === 1).sort(item => item.power).reverse()

    for (let expedition of completed) {
      let reward = await this.api.farmExpedition(expedition.id)
      this.logReward(`Expedition ${expedition.id} reward:`, reward)
    }

    let busyIds = onGoing.map(item => item.heroes).flat()
    let heroes = await this.api.getAllHeroes()

    for (let expedition of available) {
      heroes = heroes.filter(item => !busyIds.includes(item.id))

      let team = this.findTeamForExpedition(heroes, expedition.power)
      if (team === null) continue

      let heroesIds = team.map(item => item.id)
      busyIds = busyIds.concat(heroesIds)

      let quests = await this.api.sendExpedition(expedition.id, team.map(item => item.id))
      await this.farmQuests(quests)
      console.log('Expedition #%s started', expedition.id)
    }
  }

  async farmDailyBonus () {
    let bonus = await this.api.getDailyBonusInfo()
    if (bonus.availableToday) await this.api.farmDailyBonus()
  }

  async farmDailyGifts () {
    let quests = await this.api.sendClanDailyGifts()
    await this.farmQuests(quests)
  }

  async farmValkyriesBonus () {
    let reward = await this.api.farmZeppelinGift()
    this.logReward('Zeppelin reward:', reward)

    while (true) {
      let rewards = await this.api.openArtifactChests()
      if (rewards === null) break
      for (let reward of rewards) this.logReward('Artifact Chest reward:', reward)
    }
  }
}

module.exports = Bot
