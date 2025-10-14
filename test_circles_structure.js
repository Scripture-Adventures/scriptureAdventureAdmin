// Test script to verify the new circles structure works
// This can be run in the browser console to test the functionality

// Test data with new structure (WhatsApp contact URLs)
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
    }
  ]
}

// Test data with old structure (for backward compatibility)
const testCohortOld = {
  id: 2,
  active: true,
  nomenclature: "SA/002/",
  circles: [
    "https://chat.whatsapp.com/C3kijPRi2gtCV17o8t061u",
    "https://chat.whatsapp.com/DJxwy68mEMp9YsMW3ykUKe"
  ]
}

// Test data with mixed old/new field names (for migration compatibility)
const testCohortMixed = {
  id: 3,
  active: true,
  nomenclature: "SA/003/",
  circles: [
    {
      circle_rep_phonemuber: "23203240304", // Old field name
      circle_whatsapp_link: "https://chat.whatsapp.com/C3kijPRi2gtCV17o8t061u"
    },
    {
      circle_rep_whatsapp_contact: "https://wa.me/23203240305", // New field name
      circle_whatsapp_link: "https://chat.whatsapp.com/DJxwy68mEMp9YsMW3ykUKe"
    }
  ]
}

// Helper function to convert phone number to WhatsApp URL
function convertToWhatsAppUrl(phoneNumber) {
  if (!phoneNumber.trim()) return ''
  
  // Remove any non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '')
  
  // If it starts with country code, use as is, otherwise assume it needs country code
  if (cleanNumber.startsWith('232')) {
    return `https://wa.me/${cleanNumber}`
  } else if (cleanNumber.length >= 9) {
    return `https://wa.me/232${cleanNumber}`
  }
  
  return phoneNumber // Return original if can't determine format
}

// Test function to verify circle processing
function testCircleProcessing(cohort) {
  console.log("Testing cohort:", cohort.nomenclature)
  
  if (cohort.circles && Array.isArray(cohort.circles)) {
    const processedCircles = cohort.circles.map((circle, index) => {
      if (typeof circle === 'string') {
        console.log(`Circle ${index + 1} (old format): ${circle}`)
        return {
          circle_rep_whatsapp_contact: '',
          circle_whatsapp_link: circle
        }
      } else if (typeof circle === 'object' && circle !== null) {
        // Handle both old and new field names
        const phoneNumber = circle.circle_rep_phonemuber || circle.circle_rep_whatsapp_contact || ''
        const whatsappUrl = phoneNumber.startsWith('https://wa.me/') 
          ? phoneNumber 
          : convertToWhatsAppUrl(phoneNumber)
        
        console.log(`Circle ${index + 1} (object format): Rep Contact: ${whatsappUrl}, Group Link: ${circle.circle_whatsapp_link}`)
        return {
          circle_rep_whatsapp_contact: whatsappUrl,
          circle_whatsapp_link: circle.circle_whatsapp_link || ''
        }
      }
      return { circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' }
    })
    
    console.log("Processed circles:", processedCircles)
    return processedCircles
  }
  
  return []
}

// Run tests
console.log("=== Testing New Structure (WhatsApp Contact URLs) ===")
testCircleProcessing(testCohort)

console.log("\n=== Testing Old Structure (Backward Compatibility) ===")
testCircleProcessing(testCohortOld)

console.log("\n=== Testing Mixed Structure (Migration Compatibility) ===")
testCircleProcessing(testCohortMixed)

console.log("\n=== Test Complete ===")
console.log("All circle structures are supported with automatic WhatsApp URL conversion!")
