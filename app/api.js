const axios = require('axios')
const utils = require('./utils')

const UserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36'
const CacheFile = '.cache'

const GameApiUrl = 'https://heroes-wb.nextersglobal.com/api/'
const WebSiteUrl = 'https://hero-wars.com/'
const WebCookies = '' // document.cookie

class APIError extends Error {
  constructor (message) {
    super(message)
    this.error = message
  }

  static isAPIError (e) {
    return e instanceof APIError
  }

  isInvalidSession () {
    return this.error.name === 'common\\rpc\\exception\\InvalidSession'
  }

  isNotEnough () {
    return this.error.name === 'NotEnough'
  }
}

class API {
  static APIError = APIError

  constructor () {
    this.http = axios.create({
      headers: {'User-Agent': UserAgent},
    })

    this.requestId = null
    this.accountId = null
    this.sessionId = null
    this.authToken = null

    this.logFile = `logs/log-${new Date().toISOString().split('.')[0]}.json`
  }

  async loadSession () {
    return await utils.loadJson(CacheFile)
  }

  async saveSession () {
    let {requestId, accountId, sessionId, authToken} = this
    let data = {requestId, accountId, sessionId, authToken}
    return await utils.saveJson(CacheFile, data)
  }

  async saveReq (req) {
    let data = await utils.loadJson(this.logFile) || {}
    data[this.requestId] = data[this.requestId] || {}
    data[this.requestId].req = req
    await utils.saveJson(this.logFile, data)
  }

  async saveRep (rep) {
    let data = await utils.loadJson(this.logFile) || {}
    data[this.requestId] = data[this.requestId] || {}
    data[this.requestId].rep = rep
    await utils.saveJson(this.logFile, data)
  }

  async prepare (invalidateSession = false) {
    let cache = await this.loadSession()

    if (invalidateSession || cache === null) {
      let rep = await this.http.get(WebSiteUrl, {
        headers: {'Cookie': WebCookies},
      })

      this.requestId = 0
      this.accountId = rep.data.match(/var NXAccountId = '(.*?)'/)[1]
      this.sessionId = this.generateSessionId()
      this.authToken = rep.data.match(/var NXAuth = '(.*?)'/)[1]

      await this.saveSession()
    } else {
      this.requestId = cache.requestId
      this.accountId = cache.accountId
      this.sessionId = cache.sessionId
      this.authToken = cache.authToken
    }

    console.log('Connected. SessionId: %s', this.sessionId)
  }

  generateSessionId () {
    return utils.randomString(14)
  }

  generateSignature (headers, data) {
    let fingerprint = Object.entries(headers)
      .filter(el => el[0].startsWith('X-Env'))
      .map(el => `${el[0].split('X-Env-')[1].toUpperCase()}=${el[1]}`)
      .sort().join('')

    data = [
      headers['X-Request-Id'],
      headers['X-Auth-Token'],
      headers['X-Auth-Session-Id'],
      data,
      fingerprint,
    ].join(':')

    return utils.md5(data)
  }

  /**
   * @throws APIError
   */
  async callOne (name, args) {
    let data = await this.call([{name, args}])
    return data[0]
  }

  async call (calls) {
    try {
      return await this._call(calls)
    } catch (e) {
      if (!APIError.isAPIError(e)) throw new APIError(e)
      if (!e.isInvalidSession()) throw e

      await this.prepare(true)
      return await this._call(calls)
    }
  }

  async _call (calls) {
    this.requestId += 1

    let headers = {
      'X-Auth-Application-Id': 3,
      'X-Auth-Network-Ident': 'web',
      'X-Auth-Session-Id': this.sessionId,
      'X-Auth-Session-Key': '',
      'X-Auth-Token': this.authToken,
      'X-Auth-User-Id': this.accountId,
      'X-Env-Library-Version': 1,
      'X-Request-Id': this.requestId,
      'X-Requested-With': 'XMLHttpRequest',
      'X-Server-Time': 0,
    }

    if (this.requestId === 1) Object.assign(headers, {
      'X-Auth-Session-Init': 1,
      'X-Env-Referrer': '',
    })

    for (let call of calls) {
      call.args = call.args || {}
      call.ident = call.name
    }

    let data = {calls}
    await this.saveReq(data)
    await this.saveSession()

    data = JSON.stringify(data)
    headers['X-Auth-Signature'] = this.generateSignature(headers, data)

    let rep = await this.http.post(GameApiUrl, data, {headers})

    await this.saveRep(rep.data)
    if (rep.data.error) throw new APIError(rep.data.error)

    return rep.data.results.map(item => Object.assign(item.result, {name: item.ident}))
  }

  // Main

  async getState () {
    let nonArgsMethods = [
      'adventure_find',
      'adventure_getActiveData',
      'adventure_getPassed',
      'arenaGetAll',
      'artifactGetChestLevel',
      // 'billingGetLast',
      'bossGetAll',
      'campaignStoryGetList',
      // 'chatGetInfo',
      // 'chatGetTalks',
      'clanGetActivityRewardTable',
      'clanGetInfo',
      'clanGetPrevData',
      'clanWarGetBriefInfo',
      'clanWarGetWarlordInfo',
      'dailyBonusGetInfo',
      'expeditionGet',
      'freebieHaveGroup',
      'getTime',
      'hallOfFameGetTrophies',
      'heroGetAll',
      'heroesMerchantGet',
      'inventoryGet',
      'mailGetAll',
      'missionGetAll',
      'missionGetReplace',
      'newYearGetInfo',
      'offerGetAll',
      'pet_getAll',
      'pet_getChest',
      'pet_getPotionDailyBuyCount',
      'pirateTreasureIsAvailable',
      'playable_getAvailable',
      'questGetAll',
      'questGetEvents',
      'settingsGetAll',
      'shopGetAll',
      'socialQuestGetInfo',
      'splitGetAll',
      // 'subscriptionGetInfo',
      'teamGetAll',
      'titanArenaCheckForgotten',
      'titanArenaGetChestReward',
      'titanArtifactGetChest',
      'titanGetAll',
      'titanGetSummoningCircle',
      'titanSpiritGetAll',
      'towerGetInfo',
      // 'tutorialGetInfo',
      // 'userGetAvailableAvatars',
      // 'userGetAvailableStickers',
      'userGetInfo',
      'zeppelinGiftGet'
    ]

    let data = await this.call(nonArgsMethods.map(name => new Object({name})))
    return data
  }

  // User

  async registration () {
    return await this.callOne('registration', {user: {referrer: {type: 'menu', id: 0}}})
  }

  async getAllHeroes () {
    let data = await this.callOne('heroGetAll')
    return Object.values(data.response)
  }

  async sendClanDailyGifts () {
    let data = await this.callOne('clanSendDailyGifts')
    return data.quests
  }

  // Daily Bonus

  async getDailyBonusInfo () {
    let data = await this.callOne('dailyBonusGetInfo')
    return data.response
  }

  async farmDailyBonus (vip = 0) {
    let data = await this.callOne('dailyBonusFarm', {vip})
    return data.response
  }

  // Valkyrie's Bonus

  async farmZeppelinGift () {
    let data = await this.callOne('zeppelinGiftFarm')
    return data.response.reward
  }

  async openArtifactChests (amount = 1, free = true) {
    try {
      let data = await this.callOne('artifactChestOpen', {amount, free})
      return data.response.chestReward
    } catch (e) {
      if (e.isNotEnough()) return null
      else throw e
    }
  }

  // Quests

  async getAllQuests () {
    let data = await this.callOne('questGetAll')
    return data.response
  }

  async farmQuest (questId) {
    let data = await this.callOne('questFarm', {questId})
    return data.response
  }

  // Mail

  async getAllMail () {
    let data = await this.callOne('mailGetAll')
    return data.response.letters
  }

  async farmMail (letterIds) {
    let data = await this.callOne('mailFarm', {letterIds})
    return Object.values(data.response)
  }

  // Expeditions

  async getExpeditions () {
    let data = await this.callOne('expeditionGet')
    return data.response
  }

  async farmExpedition (expeditionId) {
    let data = await this.callOne('expeditionFarm', {expeditionId})
    return data.response.reward
  }

  async sendExpedition (expeditionId, heroes) {
    let data = await this.callOne('expeditionSendHeroes', {expeditionId, heroes})
    return data.response.quests
  }

  // Titans

  async getAllTitans () {
    let data = await this.callOne('titanGetAll')
    return Object.values(data.response)
  }


}

module.exports = API
