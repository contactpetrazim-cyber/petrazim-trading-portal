
import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Button } from '@mui/material';
import { styled } from '@mui/system';

const StyledCard = styled(Card)({
  minWidth: 275,
  marginBottom: '20px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  borderRadius: '8px',
});

const DashboardPage = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <StyledCard>
            <CardContent>
              <Typography variant="h5" component="div">
                Total Investments
              </Typography>
              <Typography variant="h4" color="primary">
                $1,234,567
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                As of today
              </Typography>
              <Button variant="contained" color="primary">
                View Details
              </Button>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <StyledCard>
            <CardContent>
              <Typography variant="h5" component="div">
                Recent Trades
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No recent trades to display.
              </Typography>
              <Button variant="outlined" color="primary" sx={{ mt: 2 }}>
                Make a Trade
              </Button>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <StyledCard>
            <CardContent>
              <Typography variant="h5" component="div">
                Market News
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stay updated with the latest market trends.
              </Typography>
              <Button variant="outlined" color="primary" sx={{ mt: 2 }}>
                Read News
              </Button>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Your Portfolio
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Detailed portfolio view coming soon!
        </Typography>
      </Box>
    </Box>
  );
};

export default DashboardPage;
