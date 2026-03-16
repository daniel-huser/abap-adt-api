import { ADTClient } from ".."
import { runTest } from "./login"

test(
  "Object Relations Tests",
  runTest(async (c: ADTClient) => {
    try {
      let structure = await c.objectRelations(
        "/sap/bc/adt/programs/programs/zmmscstocks"
      )
      console.log(structure)
    } catch (error) {
      console.log(error)
    }
  })
)
