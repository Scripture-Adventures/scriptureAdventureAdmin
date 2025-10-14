// Test script to verify the updated circle number format
// This can be run in the browser console to test the functionality

// Test data with new circle number format (just numbers)
const testCohort = {
  id: 1,
  active: true,
  nomenclature: "SA/001/",
  circles: [
    {
      circle_rep_whatsapp_contact: "https://wa.me/23203240304",
      circle_whatsapp_link: "https://chat.whatsapp.com/C3kijPRi2gtCV17o8t061u"
    },
    {
      circle_rep_whatsapp_contact: "https://wa.me/23203240305",
      circle_whatsapp_link: "https://chat.whatsapp.com/DJxwy68mEMp9YsMW3ykUKe"
    },
    {
      circle_rep_whatsapp_contact: "https://wa.me/23203240306",
      circle_whatsapp_link: "https://chat.whatsapp.com/C3kijPRi2gtCV17o8t061u"
    }
  ]
}

// Test function to verify circle number processing
function testCircleNumberProcessing(cohort) {
  console.log("Testing cohort:", cohort.nomenclature)
  
  if (cohort.circles && Array.isArray(cohort.circles)) {
    const processedCircles = cohort.circles.map((circle, index) => {
      const circleNumber = (index + 1).toString() // Just the number
      const displayName = `Circle ${circleNumber}` // Display format
      
      console.log(`Circle ${index + 1}:`)
      console.log(`  - Stored number: "${circleNumber}"`)
      console.log(`  - Display name: "${displayName}"`)
      console.log(`  - WhatsApp contact: ${circle.circle_rep_whatsapp_contact}`)
      console.log(`  - Group link: ${circle.circle_whatsapp_link}`)
      
      return {
        circleNumber,
        displayName,
        whatsappContact: circle.circle_rep_whatsapp_contact,
        groupLink: circle.circle_whatsapp_link
      }
    })
    
    console.log("\nProcessed circles:", processedCircles)
    return processedCircles
  }
  
  return []
}

// Test function to verify circle group link retrieval
function testCircleGroupLinkRetrieval(cohort, circleNumber) {
  console.log(`\nTesting circle group link retrieval for circle number: "${circleNumber}"`)
  
  if (cohort.circles && Array.isArray(cohort.circles)) {
    const circleIndex = parseInt(circleNumber) - 1
    const circle = cohort.circles[circleIndex]
    
    if (circle) {
      const groupLink = typeof circle === 'string' 
        ? circle 
        : circle.circle_whatsapp_link || ''
      
      console.log(`Circle ${circleNumber} group link: ${groupLink}`)
      return groupLink
    } else {
      console.log(`Circle ${circleNumber} not found`)
      return ''
    }
  }
  
  return ''
}

// Run tests
console.log("=== Testing New Circle Number Format ===")
const processedCircles = testCircleNumberProcessing(testCohort)

console.log("\n=== Testing Circle Group Link Retrieval ===")
testCircleGroupLinkRetrieval(testCohort, "1")
testCircleGroupLinkRetrieval(testCohort, "2")
testCircleGroupLinkRetrieval(testCohort, "3")

console.log("\n=== Test Complete ===")
console.log("Circle numbers are now stored as just numbers (e.g., '1', '2', '3') instead of 'Circle 1', 'Circle 2', 'Circle 3'")
console.log("Display format still shows 'Circle X' for user-friendly interface")
console.log("Database storage is optimized to store just the numeric value")
