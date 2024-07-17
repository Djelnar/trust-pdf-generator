import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomInt } from 'crypto'
import React from 'react'
import type { TrustAnalytics, TrustVerdict, User } from '../src/types'
import emojiStrip from 'emoji-strip'

const TRUST_API_URL = process.env.TRUST_API_URL!
const TRUST_API_TOKEN = process.env.TRUST_API_TOKEN!
const FAKE_IMG_API = 'fakeimg.pl'

const getReport = async (userId: string, messageId: string) => {
  return fetch(
    `https://${TRUST_API_URL}/@/trust/${userId}?messageId=${messageId}`,
    {
      headers: {
        Authorization: TRUST_API_TOKEN,
      },
    }
  ).then(async (res) => {
    if (!res.ok) {
      throw await res.json()
    }
    return res.json() as Promise<TrustAnalytics>
  })
}

const getAvatar = (payload: User) => {
  return fetch(
    `https://${TRUST_API_URL}/@/fs/avatar/${payload.id}/fullsize.jpg`
  ).then(async (res) => {
    if (res.ok) {
      return res.arrayBuffer()
    }
    return null
  })
}
const getFakeAvatar = (payload: User) => {
  const initials = [
    emojiStrip(payload.first_name).trim(),
    emojiStrip(payload?.last_name ?? '').trim(),
  ]
    .filter(Boolean)
    .map((n) => n[0])
    .join(' ')
    .toUpperCase()

  return fetch(
    `https://${FAKE_IMG_API}/100x100/dddddd/909090?text=${initials}`
  ).then((res) => {
    if (res.ok) {
      return res.arrayBuffer()
    }
    return null
  })
}

export default async function (
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  )
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  const data = request.body as {
    messageId: string
    user: User
    chatUsername: string
  }

  try {
    const report = await getReport(data.user.id, data?.messageId ?? '')

    const profilePics = await Promise.all([
      getAvatar(data.user),
      getFakeAvatar(data.user),
    ])

    const profilePic = profilePics.find(Boolean)

    if (!profilePic) {
      return response.status(500).send('Failed to fetch profile picture')
    }

    const pdf = await createReportPDF(
      report,
      data.user,
      profilePic,
      data?.chatUsername || 'Mini app'
    )
    return response
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .send(pdf)
  } catch (e) {
    return response.status(400).send(e)
  }
}

const FONT_PT_SANS = 'PT Sans'
const FONT_PT_SANS_NARROW = 'PT Sans Narrow'
const FONT_ROBOTO = 'Roboto'
const FONT_TINOS = 'Tinos'

Font.register({
  family: FONT_TINOS,
  src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/Tinos-Bold.ttf`,
  fontWeight: 'bold',
})
Font.register({
  family: FONT_ROBOTO,
  src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/Roboto-Regular.ttf`,
  fontWeight: 'normal',
})
Font.register({
  family: FONT_PT_SANS,
  src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/PTSans-Regular.ttf`,
  fontWeight: 'normal',
})
Font.register({
  family: FONT_PT_SANS,
  src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/PTSans-Bold.ttf`,
  fontWeight: 'bold',
})
Font.register({
  family: FONT_PT_SANS_NARROW,
  src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/PTSansNarrow-Regular.ttf`,
})
Font.registerEmojiSource({
  format: 'png',
  url: 'https://cdnjs.cloudflare.com/ajax/libs/emoji-datasource-apple/15.1.2/img/apple/64/',
})

const VerdictColors: Record<TrustVerdict, string> = {
  AwfulStage: 'red',
  BadStage: 'darkred',
  LowerStage: 'indianred',
  GoodStage: 'yellow',
  PerfectStage: 'lawngreen',
  VerifiedStage: 'mediumpurple',
  CertifiedStage: 'mediumpurple',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    margin: '1cm',
  },
  logoWrapper: {
    width: '13cm',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: { width: 140 },
  verdictBigWrapper: {
    position: 'absolute',
    borderWidth: 3,
    borderStyle: 'solid',
    paddingHorizontal: 4,
  },
  verdictBig: {
    fontSize: 36,
    fontFamily: FONT_TINOS,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  userProfile: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 32,
    marginTop: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    marginRight: 12,
  },
  userInfo: { height: 56, justifyContent: 'space-evenly' },
  fullName: {
    fontFamily: FONT_ROBOTO,
    fontSize: 16,
    lineHeight: 1,
  },
  userID: {
    fontFamily: FONT_PT_SANS,
    fontSize: 14,
    lineHeight: 1,
  },
  username: {
    fontFamily: FONT_PT_SANS,
    fontSize: 14,
    lineHeight: 1,
  },
  sectionTitle: {
    fontFamily: FONT_PT_SANS,
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '13cm',
    marginBottom: 14,
  },
  table: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '13cm',
    marginBottom: 24,
  },
  col: {
    alignItems: 'center',
  },
  summaryHeaderCell: {
    fontFamily: FONT_PT_SANS,
    fontSize: 14,
    lineHeight: 1,
    marginBottom: 6,
  },
  summaryBodyCell: {
    fontFamily: FONT_PT_SANS,
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 'bold',
  },
  factorsTable: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '13cm',
    marginBottom: 24,
  },
  factorsCol: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  factorsColRight: {
    alignItems: 'flex-end',
  },
  factorsHeaderCell: {
    fontFamily: FONT_PT_SANS,
    fontSize: 14,
    lineHeight: 1,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  factorsBodyCell: {
    fontFamily: FONT_PT_SANS,
    fontSize: 14,
    lineHeight: 1,
    marginBottom: 4,
  },
  alignLeft: {
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  eSigWrapper: {
    width: '13cm',
    alignItems: 'center',
    marginTop: 20,
  },
  eSig: {
    borderWidth: 2,
    borderColor: '#4c40d2',
    borderStyle: 'solid',
    borderRadius: 10,
    width: 230,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eSigStamp: {
    width: 40,
    marginRight: 3,
    flexBasis: 40,
    flexShrink: 0,
    flexGrow: 0,
  },
  eSigData: {},
  eSigTitle: {
    fontFamily: FONT_PT_SANS_NARROW,
    color: '#4c40d2',
    fontSize: 12,
    lineHeight: 1.1,
  },
  eSigInfo: {
    fontFamily: FONT_PT_SANS_NARROW,
    color: '#4c40d2',
    fontSize: 12,
    lineHeight: 1.1,
  },
})

interface ReportDocumentProps {
  user: User
  trustAnalytics: TrustAnalytics
  profilePic: ArrayBuffer
  contextId: string
}
const ReportDocument = ({
  trustAnalytics,
  user,
  profilePic,
  contextId,
}: ReportDocumentProps) => {
  const {
    factors,
    trust_score,
    mod_trust_score,
    verdict,
    report_creation_date,
    issuer,
  } = trustAnalytics
  const maxScore = factors.reduce((acc, curr) => acc + curr.max_score, 0)
  const generationDateString = new Date(
    report_creation_date * 1000
  ).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    timeStyle: 'short',
    dateStyle: 'short',
  })
  const fullName = [user.first_name, user.last_name].join(' ').trim()
  const verdictShort = verdict.replace(/Stage/i, '')
  const stampRotateDegree = randomInt(30, 40)
  const stampTop = randomInt(65, 75)
  const stampRight = randomInt(40, 50)

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A5', style: styles.page },
      React.createElement(
        View,
        {
          style: [
            styles.verdictBigWrapper,
            {
              borderColor: VerdictColors[verdict],
              transform: `rotate(-${stampRotateDegree}deg)`,
              top: stampTop,
              right: stampRight,
            },
          ],
        },
        React.createElement(
          Text,
          {
            style: [
              styles.verdictBig,
              {
                color: VerdictColors[verdict],
              },
            ],
          },
          verdictShort
        )
      ),
      React.createElement(
        View,
        { style: styles.logoWrapper },
        React.createElement(Image, {
          src: 'https://trust-tg-app.0xf6.moe/logo-group.png',
          style: styles.logo,
        })
      ),
      React.createElement(
        View,
        { style: styles.userProfile },
        React.createElement(Image, {
          src: Buffer.from(profilePic),
          style: styles.avatar,
        }),
        React.createElement(
          View,
          { style: styles.userInfo },
          React.createElement(Text, { style: styles.fullName }, fullName),
          React.createElement(Text, { style: styles.userID }, 'ID: ', user.id),
          React.createElement(
            Text,
            { style: styles.username },
            user.username && '@',
            user.username
          )
        )
      ),
      React.createElement(Text, { style: styles.sectionTitle }, 'Summary'),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(
            Text,
            { style: styles.summaryHeaderCell },
            'Verdict'
          ),
          React.createElement(
            Text,
            {
              style: [
                styles.summaryBodyCell,
                {
                  color: VerdictColors[verdict],
                },
              ],
            },
            verdictShort
          )
        ),
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(
            Text,
            { style: styles.summaryHeaderCell },
            'TrustFactor'
          ),
          React.createElement(
            Text,
            { style: styles.summaryBodyCell },
            trust_score,
            '+(',
            mod_trust_score,
            ')/',
            maxScore
          )
        )
      ),
      React.createElement(Text, { style: styles.sectionTitle }, 'Factors'),
      React.createElement(
        View,
        { style: styles.factorsTable },
        React.createElement(
          View,
          { style: styles.factorsCol },
          React.createElement(
            Text,
            { style: [styles.factorsHeaderCell, styles.alignLeft] },
            'Sampler'
          ),
          factors.map((factor) =>
            React.createElement(
              Text,
              {
                key: factor.sampler,
                style: [styles.factorsBodyCell, styles.alignLeft],
              },
              toUpperCaseFirst(factor.sampler)
            )
          )
        ),
        React.createElement(
          View,
          { style: [styles.factorsCol, styles.factorsColRight] },
          React.createElement(
            Text,
            { style: styles.factorsHeaderCell },
            'Score'
          ),
          factors.map((factor) =>
            React.createElement(
              Text,
              { key: factor.sampler, style: styles.factorsBodyCell },
              factor.score
            )
          )
        ),
        React.createElement(
          View,
          { style: [styles.factorsCol, styles.factorsColRight] },
          React.createElement(
            Text,
            { style: styles.factorsHeaderCell },
            'Max Score'
          ),
          factors.map((factor) =>
            React.createElement(
              Text,
              { key: factor.sampler, style: styles.factorsBodyCell },
              factor.max_score
            )
          )
        )
      ),
      React.createElement(
        View,
        { style: styles.eSigWrapper },
        React.createElement(
          View,
          { style: styles.eSig },
          React.createElement(Image, {
            style: styles.eSigStamp,
            src: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/stamp.png`,
          }),
          React.createElement(
            View,
            { style: styles.eSigData },
            React.createElement(
              Text,
              { style: styles.eSigTitle },
              'Document is e-Signed with certificate:'
            ),
            React.createElement(Text, { style: styles.eSigInfo }, issuer.id),
            React.createElement(
              Text,
              { style: styles.eSigInfo },
              'Context: ',
              contextId
            ),
            React.createElement(
              Text,
              { style: styles.eSigInfo },
              'Date: ',
              generationDateString
            ),
            React.createElement(
              Text,
              { style: styles.eSigInfo },
              'Report ID: ',
              issuer.report_id
            )
          )
        )
      )
    )
  )
}

function createReportPDF(
  trustAnalytics: TrustAnalytics,
  chatMember: User,
  profilePic: ArrayBuffer,
  contextId: string
) {
  return renderToBuffer(
    ReportDocument({
      trustAnalytics,
      user: chatMember,
      profilePic,
      contextId,
    })
  )
}

function toUpperCaseFirst(s: string) {
  return `${s[0].toUpperCase()}${s.slice(1)}`
}
