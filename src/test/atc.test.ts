import { ADTClient } from ".."
import { runTest } from "./login"

const readAtcVariant = async (c: ADTClient) => {
  const cust = await c.atcCustomizing()
  const cv = cust.properties.find(x => x.name === "systemCheckVariant")
  return c.atcCheckVariantId(`${cv?.value}`)
}

test(
  "ATC customizing and variant",
  runTest(async (c: ADTClient) => {
    const cust = await c.atcCustomizing()

    expect(cust).toBeDefined()
    const cv = cust.properties.find(x => x.name === "systemCheckVariant")
    expect(cv).toBeDefined()
  })
)

test(
  "ATC test variant",
  runTest(async (c: ADTClient) => {
    const variant = await readAtcVariant(c)
    expect(variant).toMatch(/^[0-9A-F]+$/i)
  })
)

test(
  "ATC run",
  runTest(async (c: ADTClient) => {
    const variant = await readAtcVariant(c)
    const run = await c.createAtcRun(
      variant,
      "/sap/bc/adt/oo/classes/zapiadt_testcase_console/source/main"
    )

    expect(run).toBeDefined()

    const nofindings = await c.atcWorklists(run.id)
    const objset =
      nofindings.objectSets.find(s => s.kind === "LAST_RUN")?.name || ""
    expect(nofindings).toBeDefined()
    expect(nofindings.objects[0]).toBeDefined()
    expect(nofindings.objects[0].findings[0]).toBeDefined()
    const findings = await c.atcWorklists(run.id, run.timestamp, objset)
    expect(findings).toBeDefined()
    expect(findings.objects[0]).toBeDefined()
    expect(findings.objects[0].findings[0]).toBeDefined()

    const proposal = await c.atcExemptProposal(
      findings.objects[0].findings[0].quickfixInfo!
    )
    expect(proposal).toBeDefined()
    if (c.isProposalMessage(proposal)) {
      expect(proposal.message).toBeDefined()
      expect(proposal.type).toBeDefined()
    } else {
      expect(proposal.finding).toBeDefined()
    }
  })
)

test(
  "ATC Automated Quickfixes",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(60000) // this usually takes longer than the default 5000
    const variant = await readAtcVariant(c)
    const run = await c.createAtcRun(
      variant,
      "/sap/bc/adt/programs/programs/z_quickfix_demo/source/main"
    )
    const nofindings = await c.atcWorklists(run.id)
    const objset =
      nofindings.objectSets.find(s => s.kind === "LAST_RUN")?.name || ""
    expect(nofindings).toBeDefined()
    expect(nofindings.objects[0]).toBeDefined()
    expect(nofindings.objects[0].findings[0]).toBeDefined()
    const findings = await c.atcWorklists(run.id, run.timestamp, objset)
    expect(findings).toBeDefined()
    expect(findings.objects[0]).toBeDefined()
    expect(findings.objects[0].findings[0]).toBeDefined()

    await c.atcAutoQuickfix(
      findings.objects[0].findings.map(finding => finding.uri)
    )
  })
)
