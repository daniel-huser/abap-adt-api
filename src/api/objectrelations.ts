import { AdtHTTP, RequestOptions } from "../AdtHTTP"
import { xmlArray, fullParse, xmlNodeAttr } from "../utilities"

export interface ObjectRelation {
  displayName: string
  exists: boolean
  canHaveComponents: boolean
  version: string
  uri: string
  type: string
  name: string
  packageName: string
  description: string
}

export async function objectRelations(
  h: AdtHTTP,
  objectUri: string
): Promise<ObjectRelation[]> {
  const headers = {
    Accept: "application/vnd.sap.adt.objectrelations.response.network.v1+xml",
    "Content-Type": "application/vnd.sap.adt.objectrelations.request.v1+xml"
  }

  const requestBody = `<?xml version="1.0" encoding="UTF-8"?><oro:request xmlns:oro="http://www.sap.com/adt/objectrelations" xmlns:adtcore="http://www.sap.com/adt/core">
    
  <oro:reference adtcore:description="DUMMY" adtcore:name="DUMMY" adtcore:packageName="DUMMY" adtcore:type="DUMMY" adtcore:uri="${objectUri}"/>
  
</oro:request>`

  const options: RequestOptions = { method: "POST", headers, body: requestBody }
  const response = await h.request(
    "/sap/bc/adt/objectrelations/network",
    options
  )

  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })

  const array = xmlArray(raw, "networkResponse", "objectReference")
  return array.map(xmlNodeAttr)
}
