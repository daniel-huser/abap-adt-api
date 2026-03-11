import { AdtHTTP } from "../AdtHTTP"
import {
  Clean,
  encodeEntity,
  fullParse,
  isString,
  mixed,
  numberParseOptions,
  orUndefined,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import * as t from "io-ts"
import { adtException, isErrorMessageType, validateParseResult } from ".."
import { parseUri, uriParts } from "./urlparser"

const exemptionKind = t.union([
  t.literal("A"),
  t.literal("I"),
  t.literal(""),
  t.string
]) // SATC_AC_RSLT_XMPT_KIND Atc based/Inline/none
const proposalFinding = mixed(
  {
    uri: t.string,
    type: t.string,
    name: t.string,
    location: t.string,
    processor: t.string,
    lastChangedBy: t.string,
    priority: t.number,
    checkId: t.string,
    checkTitle: t.string,
    messageId: t.string,
    messageTitle: t.string,
    exemptionApproval: t.string,
    exemptionKind, // SATC_AC_RSLT_XMPT_KIND Atc based/Inline/none
    checksum: t.number,
    quickfixInfo: t.string
  },
  {
    quickfixes: t.partial({
      automatic: t.boolean,
      manual: t.boolean,
      pseudo: t.boolean
    })
  }
)

const restriction = t.type({
  enabled: t.boolean,
  singlefinding: t.boolean,
  rangeOfFindings: t.type({
    enabled: t.boolean,
    restrictByObject: t.type({
      object: t.boolean,
      package: t.boolean,
      subobject: t.boolean,
      target: t.union([
        t.literal("subobject"),
        t.literal("object"),
        t.literal("package"),
        t.literal("")
      ])
    }),
    restrictByCheck: t.type({
      check: t.boolean,
      message: t.boolean,
      target: t.union([t.literal("message"), t.literal("check"), t.literal("")])
    })
  })
})

const atcProposal = mixed(
  {
    finding: t.union([proposalFinding, t.string]),
    package: t.string,
    subObject: t.string,
    subObjectType: t.string,
    subObjectTypeDescr: t.string,
    objectTypeDescr: t.string,
    approver: t.string,
    reason: t.union([t.literal("FPOS"), t.literal("OTHR"), t.literal("")]),
    justification: t.string,
    notify: t.union([
      t.literal("never"),
      t.literal("on_rejection"),
      t.literal("always")
    ]),
    restriction: restriction
  },
  {
    apprIsArea: t.string,
    checkClass: t.string,
    validUntil: t.string
  }
)

const atcProposalMessage = t.type({
  type: t.string,
  message: t.string
})
export interface RestrictByObject {
  object: boolean
  package: boolean
  subobject: boolean
  text: string
}

const atcRunResultInfo = t.type({
  type: t.string,
  description: t.string
})

const atcRunResult = t.type({
  id: t.string,
  timestamp: t.number,
  infos: t.array(atcRunResultInfo)
})

const atcExcemption = t.type({
  id: t.string,
  justificationMandatory: t.boolean,
  title: t.string
})

const atcProperty = t.type({
  name: t.string,
  value: t.union([t.boolean, t.string])
})

const atcCustomizingi = t.type({
  properties: t.array(atcProperty),
  excemptions: t.array(atcExcemption)
})

const objectSet = t.type({
  name: t.string,
  title: t.string,
  kind: t.string
})

const link = t.type({
  href: t.string,
  rel: t.string,
  type: t.string
})
const tag = t.type({
  name: t.string,
  value: t.string
})
const finding = t.type({
  uri: t.string,
  location: uriParts,
  priority: t.number,
  checkId: t.string,
  checkTitle: t.string,
  messageId: t.string,
  messageTitle: t.string,
  exemptionApproval: t.string,
  exemptionKind,
  quickfixInfo: orUndefined(t.string),
  link: link,
  processor: t.string,
  tags: t.array(tag)
})
const object = t.type({
  uri: t.string,
  type: t.string,
  name: t.string,
  packageName: t.string,
  author: t.string,
  objectTypeId: orUndefined(t.string),
  findings: t.array(finding)
})
const atcWorklist = t.type({
  id: t.string,
  timestamp: t.number,
  usedObjectSet: t.string,
  objectSetIsComplete: t.boolean,
  objectSets: t.array(objectSet),
  objects: t.array(object)
})

const atcUser = t.type({
  id: t.string,
  title: t.string
})

const autoQuickfixProposal = t.array(
  t.type({
    uri: t.string,
    qfType: t.string
  })
)

const atcCheckVariants = t.array(
  t.type({
    name: t.string,
    description: t.string
  })
)

export type AtcRunResult = Clean<t.TypeOf<typeof atcRunResult>>
export type AtcCustomizing = Clean<t.TypeOf<typeof atcCustomizingi>>
export type AtcWorkList = Clean<t.TypeOf<typeof atcWorklist>>
export type AtcUser = Clean<t.TypeOf<typeof atcUser>>
export type AtcProposal = Clean<t.TypeOf<typeof atcProposal>>
export type AtcProposalMessage = Clean<t.TypeOf<typeof atcProposalMessage>>
export type AtcCheckVariants = Clean<t.TypeOf<typeof atcCheckVariants>>

export const isProposalMessage = atcProposalMessage.is

export async function atcCustomizing(h: AdtHTTP): Promise<AtcCustomizing> {
  const headers = {
    Accept: "application/xml, application/vnd.sap.atc.customizing-v1+xml"
  }
  const response = await h.request("/sap/bc/adt/atc/customizing", { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const properties = xmlArray(raw, "customizing", "properties", "property").map(
    xmlNodeAttr
  )
  const excemptions = xmlArray(
    raw,
    "customizing",
    "exemption",
    "reasons",
    "reason"
  ).map(xmlNodeAttr)
  const retval = { properties, excemptions }
  return validateParseResult(atcCustomizingi.decode(retval))
}

export async function atcCheckVariantId(
  h: AdtHTTP,
  variant: string
): Promise<string> {
  const headers = { Accept: "text/plain" }
  const response = await h.request(
    `/sap/bc/adt/atc/worklists?checkVariant=${variant}`,
    { method: "POST", headers }
  )
  return response.body
}

export async function createAtcRun(
  h: AdtHTTP,
  variant: string,
  mainUrl: string,
  maxResults = 100
): Promise<AtcRunResult> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atc:run maximumVerdicts="${maxResults}" xmlns:atc="http://www.sap.com/adt/atc">
	<objectSets xmlns:adtcore="http://www.sap.com/adt/core">
		<objectSet kind="inclusive">
			<adtcore:objectReferences>
				<adtcore:objectReference adtcore:uri="${mainUrl}"/>
			</adtcore:objectReferences>
		</objectSet>
	</objectSets>
</atc:run>`
  const headers = {
    Accept: "application/xml",
    "Content-Type": "application/xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/runs?worklistId=${variant}`,
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const id = xmlNode(raw, "worklistRun", "worklistId")
  const ts = xmlNode(raw, "worklistRun", "worklistTimestamp")
  const infos = xmlArray(raw, "worklistRun", "infos", "info")
  const retval = { id, timestamp: new Date(ts).getTime() / 1000, infos }
  return validateParseResult(atcRunResult.decode(retval))
}

export async function atcWorklists(
  h: AdtHTTP,
  runResultId: string,
  timestamp?: number,
  usedObjectSet?: string,
  includeExemptedFindings = false
): Promise<AtcWorkList> {
  const headers = { Accept: "application/atc.worklist.v1+xml" }
  const qs = { timestamp, usedObjectSet, includeExemptedFindings }
  const response = await h.request(`/sap/bc/adt/atc/worklists/${runResultId}`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    numberParseOptions
  })
  const root = xmlNode(raw, "worklist")
  const attrs = xmlNodeAttr(root)
  const objectSets = xmlArray(root, "objectSets", "objectSet").map(xmlNodeAttr)
  const objects = xmlArray(root, "objects", "object").map(o => {
    const oa = xmlNodeAttr(o)
    const findings = xmlArray(o, "findings", "finding").map(f => {
      const fa = xmlNodeAttr(f)
      const priority = toInt(fa.priority)
      const link = xmlNodeAttr(xmlNode(f, "link"))
      const location = parseUri(fa.location)
      const messageTitle = fa.messageTitle
      const checkTitle = fa.checkTitle
      const processor = fa.processor
      const tags = xmlArray(fa, "tags", "tag").map(xmlNodeAttr)
      return {
        ...fa,
        priority,
        messageTitle,
        checkTitle,
        location,
        processor,
        messageId: `${fa.messageId}`,
        link,
        tags
      }
    })
    return { ...oa, findings }
  })
  const ts = new Date(attrs.timestamp).getTime() / 1000
  const result = { ...attrs, timestamp: ts, objectSets, objects }
  return validateParseResult(atcWorklist.decode(result))
}

export async function atcUsers(h: AdtHTTP): Promise<AtcUser[]> {
  const headers = { Accept: "application/atom+xml;type=feed" }
  const response = await h.request(`/sap/bc/adt/system/users`, { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const users = xmlArray(raw, "feed", "entry")
  return validateParseResult(t.array(atcUser).decode(users))
}

export async function atcExemptProposal(
  h: AdtHTTP,
  markerId: string
): Promise<AtcProposal | AtcProposalMessage> {
  const headers = {
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptapp.v1+xml"
  }
  const qs = { markerId }
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const root = xmlNode(raw, "exemptionApply", "exemptionProposal")
  const { message, type } = xmlNode(raw, "exemptionApply", "status") || {}
  if (isErrorMessageType(type)) throw adtException(message)
  if (message && type)
    return validateParseResult(atcProposalMessage.decode({ message, type }))
  const finding = isString(root.finding)
    ? root.finding
    : xmlNodeAttr(xmlNode(root, "finding"))
  if (!isString(finding)) {
    finding.priority = toInt(finding.priority)
    finding.checksum = toInt(finding.checksum)
    const qf = xmlNodeAttr(xmlNode(root, "finding", "quickfixes"))
    finding.quickfixes = {
      automatic: qf.automatic === "true",
      manual: qf.manual === "true",
      pseudo: qf.pseudo === "true"
    }
  }
  const {
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil
  } = root
  const { thisFinding, rangeOfFindings } = xmlNode(root, "restriction")
  const { restrictByObject, restrictByCheck } = rangeOfFindings
  const result = {
    finding,
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil,
    restriction: {
      enabled: thisFinding["@_enabled"] === "true",
      singlefinding: thisFinding["#text"] === "true",
      rangeOfFindings: {
        enabled: rangeOfFindings["@_enabled"] === "true",
        restrictByObject: {
          object: restrictByObject["@_object"] === "true",
          package: restrictByObject["@_package"] === "true",
          subobject: restrictByObject["@_subobject"] === "true",
          target: restrictByObject["#text"] || ""
        },
        restrictByCheck: {
          check: restrictByCheck["@_check"] === "true",
          message: restrictByCheck["@_message"] === "true",
          target: restrictByCheck["#text"] || ""
        }
      }
    }
  }
  return validateParseResult(atcProposal.decode(result))
}

export async function atcDocumentation(h: AdtHTTP, docUri: string) {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }
  const response = await h.request(docUri, {
    headers,
    method: "GET"
  })

  return response
}

export async function atcRequestExemption(
  h: AdtHTTP,
  proposal: AtcProposal
): Promise<AtcProposalMessage> {
  const headers = {
    "Content-Type": "application/atc.xmptprop.v1+xml",
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptprop.v1+xml"
  }
  const {
    finding,
    restriction: {
      rangeOfFindings: { restrictByCheck, restrictByObject }
    },
    restriction
  } = proposal
  const qs = { markerId: isString(finding) ? finding : finding.quickfixInfo }
  const findingXml = isString(finding)
    ? `<atcexmpt:finding>${finding}</atcexmpt:finding>`
    : `<atcfinding:finding adtcore:name="${finding.name}" adtcore:type="${
        finding.type
      }" adtcore:uri="${finding.uri}" 
    atcfinding:checkId="${finding.checkId}" atcfinding:checksum="${
      finding.checksum
    }" atcfinding:checkTitle="${encodeEntity(finding.checkTitle)}" 
    atcfinding:exemptionApproval="${
      finding.exemptionApproval
    }" atcfinding:exemptionKind="${finding.exemptionKind}" 
    atcfinding:lastChangedBy="${finding.lastChangedBy}" 
    atcfinding:location="${finding.location}" atcfinding:messageId="${
      finding.messageId
    }" atcfinding:messageTitle="${encodeEntity(finding.messageTitle)}" 
    atcfinding:priority="${finding.priority}" atcfinding:processor="${
      finding.processor
    }" atcfinding:quickfixInfo="${finding.quickfixInfo}">
      <atcfinding:quickfixes atcfinding:automatic="false" atcfinding:manual="false" atcfinding:pseudo="false" />
    </atcfinding:finding>`
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcexmpt:exemptionProposal xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcexmpt="http://www.sap.com/adt/atc/exemption" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      ${findingXml}
      <atcexmpt:package>${proposal.package}</atcexmpt:package>
      <atcexmpt:subObject>${proposal.subObject}</atcexmpt:subObject>
      <atcexmpt:subObjectType>${proposal.subObjectType}</atcexmpt:subObjectType>
      <atcexmpt:subObjectTypeDescr>${
        proposal.subObjectTypeDescr
      }</atcexmpt:subObjectTypeDescr>
      <atcexmpt:objectTypeDescr>${
        proposal.objectTypeDescr
      }</atcexmpt:objectTypeDescr>
      <atcexmpt:restriction>
        <atcexmpt:thisFinding enabled="${restriction.enabled}">${
          restriction.singlefinding
        }</atcexmpt:thisFinding>
        <atcexmpt:rangeOfFindings enabled="${
          restriction.rangeOfFindings.enabled
        }">
          <atcexmpt:restrictByObject object="${
            restrictByObject.object
          }" package="${restrictByObject.package}" subobject="${
            restrictByObject.subobject
          }">
          ${restrictByObject.target}</atcexmpt:restrictByObject>
          <atcexmpt:restrictByCheck check="${restrictByCheck.check}" message="${
            restrictByCheck.message
          }">
          ${restrictByCheck.target}</atcexmpt:restrictByCheck>
        </atcexmpt:rangeOfFindings>
      </atcexmpt:restriction>
      <atcexmpt:approver>${proposal.approver}</atcexmpt:approver>
      <atcexmpt:reason>${proposal.reason}</atcexmpt:reason>
      <atcexmpt:justification>${encodeEntity(
        proposal.justification
      )}</atcexmpt:justification>
      <atcexmpt:notify>${proposal.notify}</atcexmpt:notify>
      <atcexmpt:apprIsArea>${proposal.apprIsArea || ""}</atcexmpt:apprIsArea>
      <atcexmpt:checkClass>${proposal.checkClass || ""}</atcexmpt:checkClass>
      <atcexmpt:validUntil>${proposal.validUntil || ""}</atcexmpt:validUntil>
      </atcexmpt:exemptionProposal>`
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    body,
    qs,
    method: "POST"
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const result = validateParseResult(atcProposalMessage.decode(raw?.status))
  if (isErrorMessageType(result.type)) throw adtException(result.message)
  return validateParseResult(atcProposalMessage.decode(result))
}

export async function atcContactUri(
  h: AdtHTTP,
  findingUri: string
): Promise<string> {
  const headers = {
    "Content-Type": "application/vnd.sap.adt.atc.findingreferences.v1+xml",
    Accept: "application/vnd.sap.adt.atc.items.v1+xml"
  }
  const qs = { step: "proposal" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:findingReferences xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:findingReference adtcore:uri="${findingUri}"/>
    </atcfinding:findingReferences>`
  const response = await h.request(`/sap/bc/adt/atc/items`, {
    headers,
    body,
    method: "POST",
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const { uri } = xmlNodeAttr(xmlNode(raw, "items", "item"))
  return validateParseResult(t.string.decode(uri))
}

export async function atcChangeContact(
  h: AdtHTTP,
  itemUri: string,
  userId: string
): Promise<void> {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:items xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:item adtcore:uri="${itemUri}" atcfinding:processor="${userId}" atcfinding:status="2"/>
    </atcfinding:items>`
  await h.request(`/sap/bc/adt/atc/items`, { headers, body, method: "PUT" })
}

async function autoquickFixProposal(h: AdtHTTP, quickFixUriList: string[]) {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">` +
    quickFixUriList.reduce(
      (acc, quickFix) =>
        acc + `  <adtcore:objectReference adtcore:uri="${quickFix}"/>`,
      ""
    ) +
    `</adtcore:objectReferences>`

  const headers = {
    Accept: "application/vnd.sap.adt.atc.objectreferences.v1+xml",
    "Content-Type": "application/vnd.sap.adt.atc.objectreferences.v1+xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/autoqf/worklist?step=proposal`,
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })

  const checkMessages = xmlArray(
    raw,
    "autoQuickfixProposal",
    "checkMessages",
    "checkMessage"
  )
  const findings = checkMessages.flatMap(checkMessage =>
    xmlArray(checkMessage, "findings", "finding").map(finding => {
      const findingAttr = xmlNodeAttr(finding)
      const quickfixes = xmlNodeAttr(xmlNode(finding, "quickfixes"))
      return { uri: findingAttr.uri, qfType: quickfixes.selectedQuickfixType }
    })
  )

  return validateParseResult(autoQuickfixProposal.decode(findings))
}

async function autoquickFixPreview(
  h: AdtHTTP,
  quickFixList: { uri: string; qfType: string }[],
  addComments: boolean = true,
  useAuthor: boolean = true
) {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><autoqf:autoQuickfixSelection xmlns:autoqf="http://www.sap.com/adt/atc/autoquickfix" xmlns:adtcore="http://www.sap.com/adt/core">
  <autoqf:quickfixSelections>` +
    quickFixList.reduce(
      (acc, quickFix) =>
        acc +
        ` <autoqf:quickfixSelection adtcore:uri="${quickFix.uri}" autoqf:qfType="${quickFix.qfType}"/>`,
      ""
    ) +
    `</autoqf:quickfixSelections>
  <autoqf:transport/>
  <autoqf:ignoreErrors>false</autoqf:ignoreErrors>
  <autoqf:ignoreErrorsAllowed>true</autoqf:ignoreErrorsAllowed>
  <autoqf:userContent/>
</autoqf:autoQuickfixSelection>`

  const headers = {
    Accept: "application/vnd.sap.adt.atc.autoqf.selection.v1+xml",
    "Content-Type": "application/vnd.sap.adt.atc.autoqf.selection.v1+xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/autoqf/worklist?step=preview&useComments=${addComments}&useAuthor=${useAuthor}`,
    { method: "POST", headers: headers, body }
  )

  return response.body
    .replace(
      '<autoqf:autoQuickfixPreview xmlns:autoqf="http://www.sap.com/adt/atc/autoquickfix">',
      ""
    )
    .replace("<autoqf:conflicts/>", "")
    .replace("<autoqf:userContent/>", "")
    .replace("</autoqf:autoQuickfixPreview>", "")
}

async function autoquickFixExecute(
  h: AdtHTTP,
  genericRefactoring: string,
  addComments: boolean = true,
  useAuthor: boolean = true
) {
  const headers = {
    Accept: "application/vnd.sap.adt.atc.genericrefactoring.v1+xml",
    "Content-Type": " application/vnd.sap.adt.atc.genericrefactoring.v1+xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/autoqf/worklist?step=execute&useComments=${addComments}&useAuthor=${useAuthor}`,
    { method: "POST", headers: headers, body: genericRefactoring }
  )
}

export async function atcAutoQuickfix(h: AdtHTTP, quickFixUriList: string[]) {
  // Read Configurations
  const config = await readQuickFixConfiguration(h)

  const findings = await autoquickFixProposal(h, quickFixUriList)

  const genericRefactoring = await autoquickFixPreview(h, findings)
  await autoquickFixExecute(h, genericRefactoring)

  // Activate?
}

async function readQuickFixConfiguration(h: AdtHTTP) {
  const headers = {
    Accept: "application/vnd.sap.adt.configurations.v1+xml",
    "Content-Type": "application/vnd.sap.adt.configurations.v1+xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/configuration/configurations`,
    { method: "GET", headers: headers }
  )

  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })

  const uri = xmlNodeAttr(
    xmlNode(raw, "configurations", "configuration", "link")
  ).href

  const headersConfig = {
    Accept: "application/vnd.sap.adt.configuration.v1+xml",
    "Content-Type": "application/vnd.sap.adt.configuration.v1+xml"
  }
  const responseValue = await h.request(uri, {
    method: "GET",
    headers: headersConfig
  })

  const rawValue = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })

  const properties = xmlArray(
    rawValue,
    "configuration",
    "properties",
    "property"
  )

  return properties
}

export async function atcGetCheckVariants(h: AdtHTTP, name?: string) {
  const maxItemCount = 50
  const headers = {
    Accept: "application/vnd.sap.adt.nameditems.v1+xml",
    "Content-Type": "application/vnd.sap.adt.nameditems.v1+xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/variants?maxItemCount=${maxItemCount}&name=${name}`,
    { method: "GET", headers: headers }
  )

  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })

  const variants = xmlArray(raw, "namedItemList", "namedItem").map(
    (item: any) => {
      return {
        name: item["name"],
        description: item["description"]
      }
    }
  ) as AtcCheckVariants
  return validateParseResult(atcCheckVariants.decode(variants))
}

export async function createAtcRunMulti(
  h: AdtHTTP,
  variant: string,
  urlList: string[],
  maxResults = 100
): Promise<AtcRunResult> {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>
<atc:run maximumVerdicts="${maxResults}" xmlns:atc="http://www.sap.com/adt/atc">
	<objectSets xmlns:adtcore="http://www.sap.com/adt/core">
		<objectSet kind="inclusive">
			<adtcore:objectReferences>` +
    urlList.map(url => `<adtcore:objectReference adtcore:uri="${url}"/>`) +
    `</adtcore:objectReferences>
		</objectSet>
	</objectSets>
</atc:run>`
  const headers = {
    Accept: "application/xml",
    "Content-Type": "application/xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/runs?worklistId=${variant}`,
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const id = xmlNode(raw, "worklistRun", "worklistId")
  const ts = xmlNode(raw, "worklistRun", "worklistTimestamp")
  const infos = xmlArray(raw, "worklistRun", "infos", "info")
  const retval = { id, timestamp: new Date(ts).getTime() / 1000, infos }
  return validateParseResult(atcRunResult.decode(retval))
}
