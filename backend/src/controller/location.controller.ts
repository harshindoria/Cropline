import { Request, Response } from 'express';

export const reverseGeocodeLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
      return;
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "CropLineApp/1.0"
        }
      }
    );

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Reverse Geocode Error:', error);
    res.status(500).json({ success: false, message: 'Failed to geocode coordinates' });
  }
};
