import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Handle project request submissions
 * 
 * Uses Web3Forms (https://web3forms.com) - free, simple email service
 * No signup required, just get an access key from web3forms.com
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Validate required fields
    const requiredFields = ['projectName', 'assetType', 'contactMethod', 'contactHandle'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get Web3Forms access key from environment
    const web3FormsAccessKey = process.env.WEB3FORMS_ACCESS_KEY;

    if (!web3FormsAccessKey) {
      // Log to console if not configured
      console.log('='.repeat(50));
      console.log('NEW PROJECT REQUEST (Web3Forms not configured)');
      console.log('='.repeat(50));
      console.log(JSON.stringify({ ...formData, submittedAt: new Date().toISOString() }, null, 2));
      console.log('='.repeat(50));
      console.log('\n📧 To enable email notifications:');
      console.log('1. Visit https://web3forms.com');
      console.log('2. Enter your email and get a free access key');
      console.log('3. Add WEB3FORMS_ACCESS_KEY to .env.local');
      console.log('='.repeat(50));

      return NextResponse.json({ 
        success: true, 
        message: 'Request logged (email not configured)',
        note: 'Add WEB3FORMS_ACCESS_KEY to .env.local to enable email notifications'
      });
    }

    // Format the email content
    const emailSubject = `New Project Request: ${formData.projectName}`;
    const emailContent = `
New Project Request Submitted

Project Details:
- Name: ${formData.projectName}
- Asset Type: ${formData.assetType}
- Token Address: ${formData.tokenAddress || 'Not provided'}
- Description: ${formData.description || 'Not provided'}
- Twitter URL: ${formData.twitterUrl || 'Not provided'}
- Website URL: ${formData.websiteUrl || 'Not provided'}

Contact Information:
- Method: ${formData.contactMethod}
- Handle: ${formData.contactHandle}

Submitted at: ${new Date().toISOString()}
`;

    // Send to Web3Forms
    const web3FormsResponse = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_key: web3FormsAccessKey,
        subject: emailSubject,
        message: emailContent,
        // Include form data for better parsing
        from_name: formData.projectName,
        // hCaptcha token (if provided)
        'h-captcha-response': formData['h-captcha-response'] || '',
        // Additional metadata
        projectName: formData.projectName,
        assetType: formData.assetType,
        tokenAddress: formData.tokenAddress,
        description: formData.description,
        twitterUrl: formData.twitterUrl,
        websiteUrl: formData.websiteUrl,
        contactMethod: formData.contactMethod,
        contactHandle: formData.contactHandle,
      }),
    });

    const result = await web3FormsResponse.json();

    if (!web3FormsResponse.ok || !result.success) {
      console.error('Web3Forms API error:', result);
      return NextResponse.json(
        { 
          error: 'Failed to send email', 
          details: result.message || 'Unknown error',
          note: 'Request was received but email failed. Please check your WEB3FORMS_ACCESS_KEY.'
        },
        { status: 500 }
      );
    }

    console.log('Project request submitted successfully via Web3Forms');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Request submitted successfully',
      note: 'Email notification sent'
    });

  } catch (error: any) {
    console.error('Error processing project request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

